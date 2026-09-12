import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  partitionForBilling,
  qcInvoiceNoFor,
  generateMonthlyQcInvoice,
  type LotForBilling,
} from "@/lib/finance/qc-invoice";

const prisma = new PrismaClient();

/**
 * The RYK monthly consolidated invoice (Module 06, F-5).
 *
 * The round-trip test builds its own product, parameter and lot in a long-past
 * month and removes them again, so it never touches real QC work or a real
 * invoice number. Everything it creates is deleted in `afterAll`, including the
 * journal entry — deleting an entry together with its lines keeps the ledger
 * balanced, which `data-integrity.test.ts` asserts.
 */

// A month far enough back that INV-RYK-2019-03 can never collide with real work.
const YEAR = 2019;
const MONTH0 = 2; // March
const RATE = 123_400; // paisa — a value nothing else in the data uses

const lot = (
  name: string,
  parameter: LotForBilling["productType"]["parameter"],
): LotForBilling => ({
  id: `id-${name}`,
  lotNo: `LOT-${name}`,
  approvedAt: new Date(),
  productType: { name, testParameter: "Some Test", parameter },
});

describe("invoice numbering", () => {
  it("is one stable number per facility-month, zero padded", () => {
    expect(qcInvoiceNoFor("RYK", 2026, 5)).toBe("INV-RYK-2026-06");
    expect(qcInvoiceNoFor("RYK", 2026, 11)).toBe("INV-RYK-2026-12");
    expect(qcInvoiceNoFor("RYK", 2026, 0)).toBe("INV-RYK-2026-01");
  });

  it("is derived only from facility and month, so it cannot drift", () => {
    // Called twice with the same period it must agree — this is what makes
    // generation idempotent against the unique index on Invoice.invoiceNo.
    expect(qcInvoiceNoFor("RYK", 2026, 5)).toBe(qcInvoiceNoFor("RYK", 2026, 5));
  });
});

describe("pricing lots from the Parameters master", () => {
  const priced = { id: "p1", name: "Zinc - Total", price: 200_000, urgentPrice: null };

  it("bills a linked, priced product at the parameter's normal rate", () => {
    const { billable, skipped } = partitionForBilling([lot("Raw Zinc", priced)]);
    expect(billable).toHaveLength(1);
    expect(billable[0].price).toBe(200_000);
    expect(skipped).toEqual([]);
  });

  it("never bills a product with no parameter linked", () => {
    const { billable, skipped } = partitionForBilling([lot("Raw Zinc", null)]);
    expect(billable).toEqual([]);
    expect(skipped[0].reason).toContain("no parameter linked");
  });

  it("never bills a linked parameter that has no price", () => {
    const { billable, skipped } = partitionForBilling([
      lot("AOM", { id: "p2", name: "Bioactive Zinc", price: null, urgentPrice: null }),
    ]);
    expect(billable).toEqual([]);
    expect(skipped[0].reason).toContain("has no price");
  });

  it("groups skipped lots by product and reason with a count", () => {
    const { skipped } = partitionForBilling([
      lot("AOM", null),
      lot("AOM", null),
      lot("Raw Zinc", null),
    ]);
    expect(skipped).toHaveLength(2);
    expect(skipped.find((s) => s.product === "AOM")!.lots).toBe(2);
  });

  it("bills the priced lots and leaves the rest open, in one pass", () => {
    const { billable, skipped } = partitionForBilling([
      lot("Raw Zinc", priced),
      lot("AOM", null),
    ]);
    // The unpriced lot must not block the priced one, and must not vanish.
    expect(billable).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });
});

describe("month-end generation (round trip)", () => {
  let facilityId = "";
  let parameterId = "";
  let productTypeId = "";
  const lotIds: string[] = [];
  let invoiceId = "";
  let originalClientId: string | null = null;

  beforeAll(async () => {
    const facility = await prisma.facility.findFirst({
      where: { code: "RYK" },
      select: { id: true, qcBillingClientId: true },
    });
    if (!facility) return;
    facilityId = facility.id;
    originalClientId = facility.qcBillingClientId;

    const client = await prisma.client.findFirst({ select: { id: true } });
    await prisma.facility.update({
      where: { id: facilityId },
      data: { qcBillingClientId: client!.id },
    });

    const parameter = await prisma.parameter.create({
      data: { name: "__test rate", matrix: "__test", price: RATE, approvedAt: new Date() },
    });
    parameterId = parameter.id;

    const product = await prisma.productType.create({
      data: {
        name: "__test product",
        stage: "RAW",
        basis: "BATCH",
        testParameter: "__test",
        facilityId,
        parameterId,
      },
    });
    productTypeId = product.id;

    // Two approved lots inside the target month, one still awaiting review.
    for (const [i, status] of (["APPROVED", "APPROVED", "SUBMITTED"] as const).entries()) {
      const l = await prisma.qcLot.create({
        data: {
          lotNo: `__TEST-${YEAR}-000${i}`,
          productTypeId,
          refNo: `REF-${i}`,
          status,
          approvedAt: status === "APPROVED" ? new Date(YEAR, MONTH0, 15) : null,
          facilityId,
        },
      });
      lotIds.push(l.id);
    }
  });

  afterAll(async () => {
    // Order matters: unlink lots before the invoice, drop journal lines with
    // their entry so the ledger stays balanced either way.
    if (lotIds.length)
      await prisma.qcLot.deleteMany({ where: { id: { in: lotIds } } });
    if (invoiceId) {
      const inv = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { journalEntryId: true },
      });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
      await prisma.invoice.delete({ where: { id: invoiceId } });
      if (inv?.journalEntryId) {
        await prisma.journalLine.deleteMany({
          where: { entryId: inv.journalEntryId },
        });
        await prisma.journalEntry.delete({ where: { id: inv.journalEntryId } });
      }
    }
    if (productTypeId)
      await prisma.productType.delete({ where: { id: productTypeId } }).catch(() => {});
    if (parameterId)
      await prisma.parameter.delete({ where: { id: parameterId } }).catch(() => {});
    if (facilityId)
      await prisma.facility.update({
        where: { id: facilityId },
        data: { qcBillingClientId: originalClientId },
      });
    await prisma.$disconnect();
  });

  it("bills only approved lots, priced from the linked parameter", async () => {
    const result = await generateMonthlyQcInvoice({ year: YEAR, month0: MONTH0 });
    expect(result.status).toBe("CREATED");
    expect(result.invoiceNo).toBe(`INV-RYK-${YEAR}-03`);
    invoiceId = result.invoiceId!;

    // Two approved lots at the parameter rate. The SUBMITTED lot is not billed.
    expect(result.billedLots).toBe(2);
    expect(result.amount).toBe(2 * RATE);
  });

  it("writes one line per lot, naming the lot and the parameter", async () => {
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId } });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.price === RATE)).toBe(true);
    expect(items.every((i) => i.refId === parameterId)).toBe(true);
    expect(items[0].name).toContain("__TEST");
    expect(items[0].name).toContain("__test rate");
  });

  it("marks the billed lots so they can never be billed twice", async () => {
    const billed = await prisma.qcLot.findMany({
      where: { id: { in: lotIds }, invoiceId: { not: null } },
      select: { status: true },
    });
    expect(billed).toHaveLength(2);
    expect(billed.every((l) => l.status === "APPROVED")).toBe(true);
  });

  it("posts a balanced journal entry for the invoice", async () => {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { journalEntryId: true, amount: true },
    });
    expect(inv?.journalEntryId).toBeTruthy();
    const lines = await prisma.journalLine.findMany({
      where: { entryId: inv!.journalEntryId! },
    });
    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
    expect(dr).toBe(inv!.amount);
  });

  it("is idempotent — a second run raises nothing new", async () => {
    const before = await prisma.invoice.count();
    const again = await generateMonthlyQcInvoice({ year: YEAR, month0: MONTH0 });
    expect(again.status).toBe("EXISTS");
    expect(again.invoiceId).toBe(invoiceId);
    expect(await prisma.invoice.count()).toBe(before);
  });

  it("refuses to bill a month that has not closed", async () => {
    const now = new Date();
    const open = await generateMonthlyQcInvoice({
      year: now.getFullYear(),
      month0: now.getMonth(),
    });
    expect(open.status).toBe("MONTH_OPEN");
  });
});
