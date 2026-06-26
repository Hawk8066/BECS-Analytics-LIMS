"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canGeneratePO,
  canRecordQuotation,
  canSelectQuotation,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

function toPaisa(pkr: string): number {
  const n = parseFloat(pkr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Purchase Officer records a vendor quotation against an APPROVED PR (full path).
export async function addQuotation(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canRecordQuotation(actor.designation))
    throw new Error("Not permitted to record quotations.");

  const prId = String(formData.get("prId"));
  const vendorId = String(formData.get("vendorId"));
  const amount = toPaisa(String(formData.get("amount") || "0"));
  if (!vendorId || amount <= 0) throw new Error("Vendor and amount are required.");

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr || pr.status !== "APPROVED")
    throw new Error("PR must be approved before quotations.");

  const q = await prisma.quotation.create({
    data: { prId, vendorId, amount, createdById: actor.id },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Quotation",
    entityId: q.id,
    after: { prId, vendorId, amount },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${prId}`);
}

// COO selects the winning quotation (comparative decision).
export async function selectQuotation(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canSelectQuotation(actor.designation))
    throw new Error("Only the COO can select a quotation.");

  const prId = String(formData.get("prId"));
  const quotationId = String(formData.get("quotationId"));

  await prisma.$transaction([
    prisma.quotation.updateMany({ where: { prId }, data: { selected: false } }),
    prisma.quotation.update({
      where: { id: quotationId },
      data: { selected: true },
    }),
  ]);
  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "Quotation",
    entityId: quotationId,
    after: { selected: true },
  });
  revalidatePath(`/app/procurement/${prId}`);
}

// Purchase Officer generates the PO: from the selected quotation (full path) or
// directly with a vendor + amount for simplified-only PRs (BR-9).
export async function generatePO(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canGeneratePO(actor.designation))
    throw new Error("Not permitted to generate POs.");

  const prId = String(formData.get("prId"));
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: true, quotations: true, po: true },
  });
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "APPROVED") throw new Error("PR must be approved.");
  if (pr.po) throw new Error("A PO already exists for this PR.");

  const hasFull = pr.lines.some((l) => l.path === "FULL");
  let vendorId: string | null;
  let amount: number | null;

  if (hasFull) {
    const selected = pr.quotations.find((q) => q.selected);
    if (!selected)
      throw new Error("Select a quotation before generating the PO.");
    vendorId = selected.vendorId;
    amount = selected.amount;
  } else {
    vendorId = String(formData.get("vendorId") || "") || null;
    amount = toPaisa(String(formData.get("amount") || "0")) || null;
    if (!vendorId) throw new Error("Vendor is required.");
  }

  const facility = await prisma.facility.findUnique({
    where: { id: pr.facilityId },
  });
  const year = new Date().getFullYear();
  const poNo = await nextNumber({
    key: `PO:${facility!.code}:${year}`,
    prefix: `PO-${facility!.code}`,
    year,
    pad: 5,
  });

  await prisma.$transaction([
    prisma.purchaseOrder.create({
      data: { poNo, prId, vendorId, amount, issuedById: actor.id },
    }),
    prisma.purchaseRequest.update({
      where: { id: prId },
      data: { status: "ORDERED" },
    }),
  ]);
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "PurchaseOrder",
    entityId: poNo,
    after: { prId, vendorId, amount },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${prId}`);
}
