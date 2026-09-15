"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canIssueInvoice, canManageParameters } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { publish } from "@/lib/feed/publish";
import { generateMonthlyQcInvoice } from "@/lib/finance/qc-invoice";

/**
 * Raise the RYK monthly consolidated invoice on demand.
 *
 * The same generator the automatic sweep uses, so pressing the button early
 * simply does what month end would have done — except the invoice is attributed
 * to the person who pressed it. Idempotent: pressing it twice lands on the
 * invoice that already exists.
 */
export async function generateMonthlyQcInvoiceNow(
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  if (!canIssueInvoice(actor.designation))
    throw new Error("Not permitted to issue invoices.");

  const m = /^(\d{4})-(\d{2})$/.exec(String(formData.get("month") ?? ""));
  if (!m) throw new Error("Pick a month to invoice.");
  const year = parseInt(m[1], 10);
  const month0 = parseInt(m[2], 10) - 1;

  const result = await generateMonthlyQcInvoice({
    year,
    month0,
    actorId: actor.id,
  });

  if (result.status === "CREATED" && result.invoiceId) {
    await writeAudit({
      actorId: actor.id,
      action: "CREATE",
      entityType: "Invoice",
      entityId: result.invoiceId,
      after: {
        invoiceNo: result.invoiceNo,
        amount: result.amount,
        lots: result.billedLots,
      },
      facilityId: actor.facilityId,
    });
    // Before the redirect below — redirect throws, so nothing after it runs.
    await publish({
      template: "invoiceIssued",
      params: {
        invoiceNo: result.invoiceNo!,
        invoiceId: result.invoiceId,
        amount: (result.amount / 100).toLocaleString("en-PK"),
      },
      actor,
    });
  }

  revalidatePath("/btf-qc/reports");
  revalidatePath("/app/finance/invoices");

  if (result.invoiceId) redirect(`/app/finance/invoices/${result.invoiceId}`);
  redirect(`/btf-qc/reports?month=${m[1]}-${m[2]}&billing=${result.status}`);
}

/**
 * Choose the client the QC facility's monthly invoice is consolidated onto.
 *
 * Deliberately explicit rather than derived: BECS registers Bio Tech Fertilizers
 * against Lahore while the QC work happens at RYK, so no rule over the client's
 * own facility would find it.
 */
export async function setQcBillingClient(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canIssueInvoice(actor.designation))
    throw new Error("Not permitted to set the billing client.");

  const facilityId = String(formData.get("facilityId") ?? "");
  const raw = String(formData.get("clientId") ?? "").trim();
  const clientId = raw || null;
  if (!facilityId) throw new Error("Missing facility.");

  if (clientId) {
    const exists = await prisma.client.count({ where: { id: clientId } });
    if (!exists) throw new Error("That client no longer exists.");
  }

  await prisma.facility.update({
    where: { id: facilityId },
    data: { qcBillingClientId: clientId },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Facility",
    entityId: facilityId,
    after: { qcBillingClientId: clientId },
    facilityId: actor.facilityId,
  });

  revalidatePath("/btf-qc/reports");
}

/**
 * Point a QC product at the Parameter its testing is billed at.
 *
 * This is the whole of the pricing setup: the rate itself stays in Parameters,
 * and every future invoice reads it from there. Gated on `manageParameters`,
 * the same capability that governs prices — the Lab Manager (RYK) holds it, so
 * the link can be set from the QC screen where the products live.
 */
export async function setProductBillingParameter(
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    throw new Error("Not permitted to set billing parameters.");

  const productTypeId = String(formData.get("productTypeId") ?? "");
  const raw = String(formData.get("parameterId") ?? "").trim();
  const parameterId = raw || null;
  if (!productTypeId) throw new Error("Missing product type.");

  if (parameterId) {
    const exists = await prisma.parameter.count({ where: { id: parameterId } });
    if (!exists) throw new Error("That parameter no longer exists.");
  }

  await prisma.productType.update({
    where: { id: productTypeId },
    data: { parameterId },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "ProductType",
    entityId: productTypeId,
    after: { parameterId },
    facilityId: actor.facilityId,
  });

  revalidatePath("/btf-qc");
  revalidatePath("/btf-qc/reports");
}
