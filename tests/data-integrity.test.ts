import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { stockLevel } from "@/lib/inventory";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { TEMPLATES } from "@/lib/feed/templates";

/**
 * Integration checks against the database, asserting the invariants the SSOT
 * states as business rules. These run against whatever DATABASE_URL points at
 * (the dev Postgres by default) and are read-only.
 *
 * They exist because rules like "the ledger must always balance" and "a verifier
 * must differ from the analyst" are the kind of thing that breaks silently and
 * is expensive to discover late.
 */
const prisma = new PrismaClient();
beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("BR-16 · double-entry general ledger", () => {
  it("balances overall (Σ debits = Σ credits)", async () => {
    const agg = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
    expect(agg._sum.debit ?? 0).toBe(agg._sum.credit ?? 0);
  });

  it("balances within every individual journal entry", async () => {
    const entries = await prisma.journalEntry.findMany({
      include: { lines: { select: { debit: true, credit: true } } },
    });
    const unbalanced = entries
      .filter((e) => e.lines.reduce((s, l) => s + l.debit, 0) !== e.lines.reduce((s, l) => s + l.credit, 0))
      .map((e) => e.entryNo);
    expect(unbalanced).toEqual([]);
  });

  it("has no journal entry without lines", async () => {
    const entries = await prisma.journalEntry.findMany({ include: { lines: true } });
    expect(entries.filter((e) => e.lines.length === 0).map((e) => e.entryNo)).toEqual([]);
  });
});

describe("receivables & payables", () => {
  it("no invoice is overpaid, and its status matches the payments", async () => {
    const rows = await prisma.invoice.findMany({ include: { payments: true } });
    const over: string[] = [];
    const stale: string[] = [];
    for (const i of rows) {
      const paid = i.payments.reduce((s, p) => s + p.amount, 0);
      if (paid > i.amount) over.push(i.invoiceNo);
      const expected = paid >= i.amount && i.amount > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "ISSUED";
      if (i.status !== expected) stale.push(`${i.invoiceNo}:${i.status}≠${expected}`);
    }
    expect(over).toEqual([]);
    expect(stale).toEqual([]);
  });

  it("no vendor bill is overpaid, and its status matches the payments", async () => {
    const rows = await prisma.vendorBill.findMany({ include: { payments: true } });
    const bad = rows.filter((b) => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const expected = paid >= b.amount && b.amount > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "ISSUED";
      return paid > b.amount || b.status !== expected;
    });
    expect(bad.map((b) => b.billNo)).toEqual([]);
  });

  it("no external-lab bill is overpaid, and its status matches the payments", async () => {
    const rows = await prisma.outsourceBill.findMany({ include: { payments: true } });
    const bad = rows.filter((b) => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const expected = paid >= b.amount && b.amount > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "ISSUED";
      return paid > b.amount || b.status !== expected;
    });
    expect(bad.map((b) => b.billNo)).toEqual([]);
  });
});

describe("BR-7 · identifiers are unique", () => {
  it.each([
    ["Invoice.invoiceNo", async () => (await prisma.invoice.findMany({ select: { invoiceNo: true } })).map((r) => r.invoiceNo)],
    ["PurchaseRequest.prNo", async () => (await prisma.purchaseRequest.findMany({ select: { prNo: true } })).map((r) => r.prNo)],
    ["Sample.labId", async () => (await prisma.sample.findMany({ select: { labId: true } })).map((r) => r.labId)],
    ["Client.clientNo", async () => (await prisma.client.findMany({ select: { clientNo: true } })).map((r) => r.clientNo)],
    ["Vendor.vendorNo", async () => (await prisma.vendor.findMany({ select: { vendorNo: true } })).map((r) => r.vendorNo)],
  ] as const)("%s", async (_label, load) => {
    const vals = await load();
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("sample lifecycle", () => {
  it("no ASSIGNED sample has an unassigned parameter", async () => {
    // Regression guard for the QA finding: such samples appear in NO work queue
    // ("to assign" counts REGISTERED, "to verify" counts RESULTS_ENTERED).
    const stuck = await prisma.sample.findMany({
      where: {
        status: "ASSIGNED",
        parameters: { some: { assignedToId: null, outsourceLabId: null } },
      },
      select: { labId: true },
    });
    expect(stuck.map((s) => s.labId)).toEqual([]);
  });

  it("no sample advanced past result entry with a missing result", async () => {
    const bad = await prisma.sample.findMany({
      where: {
        status: { in: ["RESULTS_ENTERED", "VERIFIED", "REPORTED"] },
        parameters: { some: { resultValue: null } },
      },
      select: { labId: true },
    });
    expect(bad.map((s) => s.labId)).toEqual([]);
  });

  it("BR-4 · a verifier never also entered a result on the same sample", async () => {
    const [samples, sigs] = await Promise.all([
      prisma.sample.findMany({ select: { id: true, labId: true, parameters: { select: { enteredById: true } } } }),
      prisma.signature.findMany({ where: { subjectType: "Sample", meaning: "verified" } }),
    ]);
    const verifiersOf = new Map<string, string[]>();
    for (const s of sigs) verifiersOf.set(s.subjectId, [...(verifiersOf.get(s.subjectId) ?? []), s.signerId]);
    const violations = samples.filter((s) => {
      const enterers = new Set(s.parameters.map((p) => p.enteredById).filter(Boolean));
      return (verifiersOf.get(s.id) ?? []).some((v) => enterers.has(v));
    });
    expect(violations.map((s) => s.labId)).toEqual([]);
  });
});

describe("BR-10 · stores & inventory", () => {
  it("has exactly one MAIN store", async () => {
    expect(await prisma.store.count({ where: { type: "MAIN" } })).toBe(1);
  });

  it("holds no negative stock", async () => {
    const bad = await prisma.inventoryItem.findMany({
      where: { quantity: { lt: 0 } },
      select: { name: true },
    });
    expect(bad.map((i) => i.name)).toEqual([]);
  });

  it("routes every issue request out of the MAIN store", async () => {
    const main = await prisma.store.findFirst({ where: { type: "MAIN" }, select: { id: true } });
    expect(main).not.toBeNull();
    expect(await prisma.issueRequest.count({ where: { fromStoreId: { not: main!.id } } })).toBe(0);
  });

  it("computes a stock level for every item without throwing", async () => {
    const items = await prisma.inventoryItem.findMany({ select: { quantity: true, reorderLevel: true } });
    for (const i of items) expect(["OK", "REORDER", "OUT"]).toContain(stockLevel(i.quantity, i.reorderLevel));
  });
});

describe("payroll", () => {
  it("net pay equals gross less all deductions on every payroll item", async () => {
    const items = await prisma.payrollItem.findMany();
    const bad = items.filter(
      (i) => i.netPay !== i.gross - i.providentFund - i.incomeTax - i.eobi - i.advances,
    );
    expect(bad.map((i) => i.id)).toEqual([]);
  });
});

describe("authorization & capability matrix", () => {
  it("every ACTIVE staff user has a personnel profile", async () => {
    const n = await prisma.user.count({
      where: {
        status: "ACTIVE",
        profile: null,
        designation: { notIn: ["CLIENT", "VENDOR", "OUTSOURCE_LAB"] },
      },
    });
    expect(n).toBe(0);
  });

  it("stored capability overrides reference known capabilities", async () => {
    const known = new Set<string>(CAPABILITIES.map((c) => c.key));
    const grants = await prisma.capabilityGrant.findMany({ select: { capability: true } });
    expect(grants.filter((g) => !known.has(g.capability)).map((g) => g.capability)).toEqual([]);
  });
});

describe("notifications & news reel", () => {
  it("every stored feed event uses a known template and a real audience", async () => {
    const known = new Set(Object.keys(TEMPLATES));
    const caps = new Set<string>(CAPABILITIES.map((c) => c.key));
    const rows = await prisma.feedEvent.findMany({ select: { template: true, audienceKey: true } });
    expect(rows.filter((r) => !known.has(r.template)).map((r) => r.template)).toEqual([]);
    expect(rows.filter((r) => !caps.has(r.audienceKey)).map((r) => r.audienceKey)).toEqual([]);
  });

  it("every feed event is facility+section scoped (else it is invisible to staff)", async () => {
    const rows = await prisma.feedEvent.findMany({ select: { id: true, facilityId: true, sectionId: true } });
    expect(rows.filter((r) => !r.facilityId || !r.sectionId).map((r) => r.id)).toEqual([]);
  });

  it("every notification uses a known template", async () => {
    const known = new Set(Object.keys(TEMPLATES));
    const rows = await prisma.notification.findMany({ select: { template: true } });
    expect(rows.filter((r) => !known.has(r.template)).map((r) => r.template)).toEqual([]);
  });
});
