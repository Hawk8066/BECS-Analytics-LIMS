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

export type FormState = { error?: string; ok?: boolean };

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

// Issue an invoice for an accepted quotation — bills the quote's client for its
// net (post-discount) total and links the two, so testing work is invoiced from
// the Samples & Testing side without re-typing the amount. Same GL posting as a
// manual invoice. Idempotent: a quote already invoiced jumps to that invoice.
export async function issueInvoiceForQuotation(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canIssueInvoice(actor.designation))
    throw new Error("Not permitted to issue invoices.");

  const quotationId = String(formData.get("quotationId") ?? "");
  const quote = await prisma.testQuotation.findUnique({
    where: { id: quotationId },
    select: { id: true, status: true, clientId: true, quoteNo: true, sampleQty: true, taxPct: true, items: true },
  });
  if (!quote) throw new Error("Quotation not found.");
  if (quote.status !== "ACCEPTED")
    throw new Error("Only an accepted quotation can be invoiced.");
  if (quote.items.length === 0) throw new Error("Quotation has no items to invoice.");

  // Don't bill the same quote twice; open the existing invoice instead.
  const existing = await prisma.invoice.findFirst({
    where: { quotationId },
    select: { id: true },
  });
  if (existing) redirect(`/app/finance/invoices/${existing.id}`);

  // Bill exactly what was quoted: each line's net (list price less any per-line
  // quotation discount) times the sample quantity. Discounts come from the quote
  // — they are not re-entered on the invoice.
  const lines = quote.items.map((it) => ({
    kind: it.kind,
    refId: it.refId,
    name: it.name,
    price: (it.price - it.discount) * quote.sampleQty,
    discount: 0,
  }));
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  const net = subtotal;
  if (net <= 0) throw new Error("Nothing to invoice — the quotation total is zero.");

  // Services tax is chosen at invoice time, defaulting to the quote's rate.
  const allowedTax = [0, 5, 15, 16];
  const taxRaw = parseInt(String(formData.get("taxPct") ?? String(quote.taxPct)), 10);
  const taxPct = allowedTax.includes(taxRaw) ? taxRaw : 0;
  const tax = Math.round((net * taxPct) / 100);
  const amount = net + tax; // tax-inclusive payable
  const discountKind = "NONE" as const;
  const discountValue = 0;

  const facility = await prisma.facility.findUnique({ where: { id: actor.facilityId } });
  const year = new Date().getFullYear();
  const invoiceNo = await nextNumber({
    key: `INV:${facility!.code}:${year}`,
    prefix: `INV-${facility!.code}`,
    year,
    pad: 5,
  });

  const entry = await postJournal({
    memo: `Invoice ${invoiceNo} — ${quote.quoteNo}`,
    createdById: actor.id,
    lines: [
      { accountCode: "1100", debit: amount }, // Accounts Receivable (tax-inclusive)
      { accountCode: "4000", credit: net }, // Sales Revenue (net of tax)
      ...(tax > 0 ? [{ accountCode: "2100", credit: tax }] : []), // Sales Tax Payable
    ],
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo,
      clientId: quote.clientId,
      quotationId: quote.id,
      subtotal,
      discountKind,
      discountValue,
      taxPct,
      amount,
      memo: `Testing services — ${quote.quoteNo}`,
      issuedById: actor.id,
      journalEntryId: entry.id,
      facilityId: actor.facilityId,
      items: { create: lines },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Invoice",
    entityId: invoice.id,
    after: { invoiceNo, amount, taxPct, quotationId: quote.id },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/invoices");
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
  return { ok: true };
}
