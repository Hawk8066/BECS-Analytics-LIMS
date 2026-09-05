"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageOutsourceBilling, canRecordPayment } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { publish } from "@/lib/feed/publish";
import { nextNumber } from "@/lib/numbering";
import { postJournal } from "@/lib/finance/posting";

export type FormState = { error?: string; ok?: boolean };

function toPaisa(pkr: string): number {
  const n = parseFloat(pkr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Record a supplier's invoice — the point a purchase stops being a commitment
 * and becomes a payable. Posts Dr Purchases & Supplies (net) / Dr Input Tax /
 * Cr Accounts Payable, mirroring an outsource-lab bill.
 */
export async function createVendorBill(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageOutsourceBilling(actor.designation))
    return { error: "Not permitted to record vendor bills." };

  const vendorId = String(formData.get("vendorId") || "");
  if (!vendorId) return { error: "Select a vendor." };
  const vendorInvoiceNo = String(formData.get("vendorInvoiceNo") || "").trim() || null;
  const memo = String(formData.get("memo") || "").trim() || null;

  const net = toPaisa(String(formData.get("subtotal") || "0"));
  if (net <= 0) return { error: "Amount must be greater than zero." };
  const taxPct = Math.min(
    100,
    Math.max(0, parseInt(String(formData.get("taxPct") || "0"), 10) || 0),
  );
  const tax = Math.round((net * taxPct) / 100);
  const amount = net + tax;

  // A PO is optional (petty purchases have none) but must belong to the chosen
  // vendor when given, so a bill can't be filed against someone else's order.
  const poId = String(formData.get("poId") || "") || null;
  if (poId) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { vendorId: true },
    });
    if (!po) return { error: "Purchase order not found." };
    if (po.vendorId !== vendorId)
      return { error: "That purchase order belongs to a different vendor." };
  }

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  const year = new Date().getFullYear();
  const billNo = await nextNumber({
    key: `VBILL:${facility!.code}:${year}`,
    prefix: `VBILL-${facility!.code}`,
    year,
    pad: 5,
  });

  const entry = await postJournal({
    memo: `Vendor bill ${billNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "5300", debit: net }, // Purchases & Supplies (net)
      ...(tax > 0 ? [{ accountCode: "1150", debit: tax }] : []), // Input Tax Recoverable
      { accountCode: "2000", credit: amount }, // Accounts Payable (gross)
    ],
  });
  const bill = await prisma.vendorBill.create({
    data: {
      billNo,
      vendorId,
      poId,
      vendorInvoiceNo,
      subtotal: net,
      taxPct,
      amount,
      memo,
      journalEntryId: entry.id,
      facilityId: actor.facilityId,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "VendorBill",
    entityId: bill.id,
    after: { billNo, amount, taxPct, vendorId, poId, vendorInvoiceNo },
    facilityId: actor.facilityId,
  });
  await publish({
    template: "vendorBillRecorded",
    params: {
      billNo,
      billId: bill.id,
      amount: (amount / 100).toLocaleString("en-PK"),
    },
    actor,
  });

  revalidatePath("/app/finance/vendor-bills");
  revalidatePath("/app/finance");
  redirect(`/app/finance/vendor-bills/${bill.id}`);
}

/** Pay a vendor against a bill: posts Dr Accounts Payable / Cr Bank. */
export async function recordVendorPayment(
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

  const bill = await prisma.vendorBill.findUnique({
    where: { id: billId },
    include: { payments: true },
  });
  if (!bill) return { error: "Bill not found." };

  const alreadyPaid = bill.payments.reduce((s, p) => s + p.amount, 0);
  if (alreadyPaid + amount > bill.amount)
    return { error: "That is more than the outstanding balance on this bill." };

  const entry = await postJournal({
    memo: `Payment for ${bill.billNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "2000", debit: amount }, // Accounts Payable
      { accountCode: "1010", credit: amount }, // Bank
    ],
  });
  await prisma.vendorPayment.create({
    data: { billId, amount, method, paidById: actor.id, journalEntryId: entry.id },
  });

  const paid = alreadyPaid + amount;
  await prisma.vendorBill.update({
    where: { id: billId },
    data: { status: paid >= bill.amount ? "PAID" : "PARTIAL" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "VendorPayment",
    entityId: billId,
    after: { amount },
    facilityId: bill.facilityId,
  });
  await publish({
    template: "vendorPaymentRecorded",
    params: {
      billNo: bill.billNo,
      billId,
      amount: (amount / 100).toLocaleString("en-PK"),
    },
    actor,
    facilityId: bill.facilityId,
  });

  revalidatePath(`/app/finance/vendor-bills/${billId}`);
  revalidatePath("/app/finance");
  return { ok: true };
}
