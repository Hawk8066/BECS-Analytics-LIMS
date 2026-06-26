"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canIssueInvoice, canRecordPayment } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { postJournal } from "@/lib/finance/posting";

export type FormState = { error?: string };

function toPaisa(pkr: string): number {
  const n = parseFloat(pkr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const InvoiceSchema = z.object({
  clientId: z.string().min(1, "Select a client"),
  amount: z.string(),
  memo: z.string().optional(),
});

// Issue a client invoice: posts Dr Accounts Receivable / Cr Sales Revenue.
export async function issueInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canIssueInvoice(actor.designation))
    return { error: "Not permitted to issue invoices." };

  const parsed = InvoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const amount = toPaisa(d.amount);
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  const year = new Date().getFullYear();
  const invoiceNo = await nextNumber({
    key: `INV:${facility!.code}:${year}`,
    prefix: `INV-${facility!.code}`,
    year,
    pad: 5,
  });

  const entry = await postJournal({
    memo: `Invoice ${invoiceNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "1100", debit: amount }, // Accounts Receivable
      { accountCode: "4000", credit: amount }, // Sales Revenue
    ],
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo,
      clientId: d.clientId,
      amount,
      memo: d.memo || null,
      issuedById: actor.id,
      journalEntryId: entry.id,
      facilityId: actor.facilityId,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Invoice",
    entityId: invoice.id,
    after: { invoiceNo, amount },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/finance/invoices");
  redirect(`/app/finance/invoices/${invoice.id}`);
}

// Record a client payment: posts Dr Bank / Cr Accounts Receivable.
export async function recordPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRecordPayment(actor.designation))
    return { error: "Not permitted to record payments." };

  const invoiceId = String(formData.get("invoiceId"));
  const amount = toPaisa(String(formData.get("amount") || "0"));
  const method = String(formData.get("method") || "") || null;
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return { error: "Invoice not found." };

  const entry = await postJournal({
    memo: `Payment for ${invoice.invoiceNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "1010", debit: amount }, // Bank
      { accountCode: "1100", credit: amount }, // Accounts Receivable
    ],
  });
  await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      method,
      receivedById: actor.id,
      journalEntryId: entry.id,
    },
  });

  const paid =
    invoice.payments.reduce((s, p) => s + p.amount, 0) + amount;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: paid >= invoice.amount ? "PAID" : "PARTIAL" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Payment",
    entityId: invoiceId,
    after: { amount },
    facilityId: invoice.facilityId,
  });

  revalidatePath(`/app/finance/invoices/${invoiceId}`);
  return {};
}
