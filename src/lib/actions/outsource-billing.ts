"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canSetOutsourcePrice,
  canManageOutsourceBilling,
  canRecordPayment,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { postJournal } from "@/lib/finance/posting";

export type FormState = { error?: string; ok?: boolean };

function toPaisa(pkr: string): number {
  const n = parseFloat(pkr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Set what an outsource lab charges us for one parameter (PKR paisa). Blank
// clears the price. Set by lab coordinators + finance. Void form action.
export async function setOutsourceLabPrice(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canSetOutsourcePrice(actor.designation))
    throw new Error("Not permitted to set outsource prices.");

  const outsourceLabId = String(formData.get("outsourceLabId") || "");
  const parameterId = String(formData.get("parameterId") || "");
  if (!outsourceLabId || !parameterId) throw new Error("Missing lab or parameter.");
  const raw = String(formData.get("price") || "").trim();
  const price = raw === "" ? null : toPaisa(raw);
  if (price !== null && price < 0) throw new Error("Price cannot be negative.");

  await prisma.outsourceLabPrice.upsert({
    where: { outsourceLabId_parameterId: { outsourceLabId, parameterId } },
    update: { price },
    create: { outsourceLabId, parameterId, price },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "OutsourceLabPrice",
    entityId: `${outsourceLabId}:${parameterId}`,
    after: { price },
  });
  revalidatePath(`/app/outsource-labs/${outsourceLabId}`);
}

// Record a bill from an outsource lab for the tests we subcontracted to it.
// Posts Dr Operating Expenses (net) / Dr Input Tax (if any) / Cr Accounts Payable.
export async function createOutsourceBill(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageOutsourceBilling(actor.designation))
    throw new Error("Not permitted to record outsource bills.");

  const outsourceLabId = String(formData.get("outsourceLabId") || "");
  const labInvoiceNo = String(formData.get("labInvoiceNo") || "").trim() || null;
  const ids = formData.getAll("sampleParameterId").map(String).filter(Boolean);
  if (!outsourceLabId) throw new Error("Missing lab.");
  if (ids.length === 0) throw new Error("Select at least one test to bill.");

  // Refetch the billable set server-side (never trust the client): outsourced to
  // this lab, not yet billed, in the actor's facility.
  const billable = await prisma.sampleParameter.findMany({
    where: {
      outsourceLabId,
      outsourceBillId: null,
      sample: { facilityId: actor.facilityId },
    },
    include: {
      parameter: { select: { id: true, name: true } },
      sample: { select: { labId: true } },
    },
  });
  const selected = billable.filter((sp) => ids.includes(sp.id));
  if (selected.length === 0) throw new Error("None of the selected tests are billable.");

  // Snapshot each test's price from the lab's price list; reject if any unpriced.
  const prices = await prisma.outsourceLabPrice.findMany({
    where: { outsourceLabId, parameterId: { in: selected.map((s) => s.parameterId) } },
    select: { parameterId: true, price: true },
  });
  const priceByParam = new Map(prices.map((p) => [p.parameterId, p.price]));
  const items: {
    sampleParameterId: string;
    name: string;
    sampleLabId: string;
    price: number;
  }[] = [];
  for (const sp of selected) {
    const price = priceByParam.get(sp.parameterId);
    if (price == null)
      throw new Error(
        `Set a price for "${sp.parameter.name}" on this lab before billing it.`,
      );
    items.push({
      sampleParameterId: sp.id,
      name: sp.parameter.name,
      sampleLabId: sp.sample.labId,
      price,
    });
  }
  const listTotal = items.reduce((s, i) => s + i.price, 0);

  // Net defaults to the price-list total but is adjustable to the lab's actual
  // invoiced net; input sales tax is tracked separately.
  const netRaw = String(formData.get("netTotal") || "").trim();
  const net = netRaw === "" ? listTotal : toPaisa(netRaw);
  if (net <= 0) throw new Error("Net total must be greater than zero.");
  const taxPct = Math.min(
    100,
    Math.max(0, parseInt(String(formData.get("taxPct") || "0"), 10) || 0),
  );
  const tax = Math.round((net * taxPct) / 100);
  const amount = net + tax;

  const facility = await prisma.facility.findUnique({ where: { id: actor.facilityId } });
  const year = new Date().getFullYear();
  const billNo = await nextNumber({
    key: `OBILL:${facility!.code}:${year}`,
    prefix: `OBILL-${facility!.code}`,
    year,
    pad: 5,
  });

  // Create the bill + lock the tests atomically; post the GL only after the lock
  // succeeds, so a lost double-bill race leaves no orphan journal entry.
  const bill = await prisma.$transaction(async (tx) => {
    const b = await tx.outsourceBill.create({
      data: {
        billNo,
        outsourceLabId,
        labInvoiceNo,
        subtotal: net,
        taxPct,
        amount,
        facilityId: actor.facilityId,
        createdById: actor.id,
        items: { create: items },
      },
    });
    const locked = await tx.sampleParameter.updateMany({
      where: { id: { in: selected.map((s) => s.id) }, outsourceBillId: null },
      data: { outsourceBillId: b.id },
    });
    if (locked.count !== selected.length)
      throw new Error("A selected test was billed by someone else — please retry.");
    return b;
  });

  const entry = await postJournal({
    memo: `Outsource bill ${billNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "5000", debit: net }, // Operating Expenses (net)
      ...(tax > 0 ? [{ accountCode: "1150", debit: tax }] : []), // Input Tax Recoverable
      { accountCode: "2000", credit: amount }, // Accounts Payable (gross)
    ],
  });
  await prisma.outsourceBill.update({
    where: { id: bill.id },
    data: { journalEntryId: entry.id },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "OutsourceBill",
    entityId: bill.id,
    after: { billNo, amount, taxPct, tests: selected.length, labInvoiceNo },
    facilityId: actor.facilityId,
  });

  revalidatePath(`/app/outsource-labs/${outsourceLabId}`);
  revalidatePath("/app/finance/outsource-bills");
  redirect(`/app/finance/outsource-bills/${bill.id}`);
}

// Record a payment to an outsource lab: posts Dr Accounts Payable / Cr Bank.
export async function recordOutsourcePayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRecordPayment(actor.designation))
    return { error: "Not permitted to record payments." };

  const billId = String(formData.get("billId"));
  const amount = toPaisa(String(formData.get("amount") || "0"));
  const method = String(formData.get("method") || "") || null;
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const bill = await prisma.outsourceBill.findUnique({
    where: { id: billId },
    include: { payments: true },
  });
  if (!bill) return { error: "Bill not found." };

  const entry = await postJournal({
    memo: `Payment for ${bill.billNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "2000", debit: amount }, // Accounts Payable
      { accountCode: "1010", credit: amount }, // Bank
    ],
  });
  await prisma.outsourcePayment.create({
    data: { billId, amount, method, paidById: actor.id, journalEntryId: entry.id },
  });

  const paid = bill.payments.reduce((s, p) => s + p.amount, 0) + amount;
  await prisma.outsourceBill.update({
    where: { id: billId },
    data: { status: paid >= bill.amount ? "PAID" : "PARTIAL" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "OutsourcePayment",
    entityId: billId,
    after: { amount },
    facilityId: bill.facilityId,
  });

  revalidatePath(`/app/finance/outsource-bills/${billId}`);
  return { ok: true };
}
