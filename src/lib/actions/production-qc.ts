"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canManageProductionQc,
  canApproveLot,
  canSubmitResult,
  ANALYST_DESIGNATIONS,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { publish } from "@/lib/feed/publish";
import { nextNumber } from "@/lib/numbering";

export type FormState = { error?: string };

// An assignee must be an active RYK analyst.
async function isRykAnalyst(userId: string): Promise<boolean> {
  const n = await prisma.user.count({
    where: {
      id: userId,
      designation: { in: [...ANALYST_DESIGNATIONS] },
      status: "ACTIVE",
      facility: { code: "RYK" },
    },
  });
  return n > 0;
}

// Compute PASS/FAIL against a product's spec limits. Returns null when no spec
// is configured (value is recorded but not judged).
function judge(
  value: number,
  specMin: number | null,
  specMax: number | null,
): string | null {
  if (specMin == null && specMax == null) return null;
  if (specMin != null && value < specMin) return "FAIL";
  if (specMax != null && value > specMax) return "FAIL";
  return "PASS";
}

// Book a QC lot (a vehicle load or a production batch) with an auto lab number
// and manual production ref; optionally link parent lots for traceability.
export async function bookLot(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageProductionQc(actor.designation))
    return { error: "Not permitted to book production lots." };

  const productTypeId = String(formData.get("productTypeId") ?? "");
  const refNo = String(formData.get("refNo") ?? "").trim();
  if (!productTypeId) return { error: "Missing product type." };
  if (!refNo) return { error: "Enter the vehicle/batch number." };

  const product = await prisma.productType.findUnique({
    where: { id: productTypeId },
  });
  if (!product) return { error: "Product type not found." };

  const parentIds = formData
    .getAll("parentLotId")
    .map(String)
    .filter(Boolean);

  // Validate parents belong to the configured parent product type.
  if (parentIds.length && product.parentTypeId) {
    const valid = await prisma.qcLot.count({
      where: { id: { in: parentIds }, productTypeId: product.parentTypeId },
    });
    if (valid !== parentIds.length)
      return { error: "One or more selected parent lots are invalid." };
  }

  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  if (assignedToId && !(await isRykAnalyst(assignedToId)))
    return { error: "Assignee must be an active RYK analyst." };
  const producedRaw = String(formData.get("producedOn") ?? "");
  const qtyRaw = String(formData.get("quantity") ?? "").trim();
  const facility = await prisma.facility.findUnique({
    where: { id: product.facilityId },
  });
  const year = new Date().getFullYear();
  const lotNo = await nextNumber({
    key: `QCLOT:${facility!.code}:${year}`,
    prefix: `${facility!.code}-QC`,
    year,
    pad: 4,
  });

  const lot = await prisma.qcLot.create({
    data: {
      lotNo,
      productTypeId,
      refNo,
      producedOn: producedRaw ? new Date(producedRaw) : null,
      quantity: qtyRaw ? parseFloat(qtyRaw) : null,
      quantityUnit: String(formData.get("quantityUnit") ?? "").trim() || null,
      source: String(formData.get("source") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
      bookedById: actor.id,
      assignedToId,
      facilityId: product.facilityId,
      parents: parentIds.length
        ? { create: parentIds.map((parentLotId) => ({ parentLotId })) }
        : undefined,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "QcLot",
    entityId: lot.id,
    after: { lotNo, product: product.name, refNo, parents: parentIds.length },
    facilityId: product.facilityId,
  });
  await publish({
    template: "qcLotBooked",
    params: { lotNo, lotId: lot.id, product: product.name },
    actor,
    facilityId: product.facilityId,
    to: [lot.assignedToId],
  });

  revalidatePath("/btf-qc");
  redirect(`/btf-qc/${lot.id}`);
}

// Analyst submits the test result; auto-judged against the product spec and sent
// for Lab Manager review. Only the assigned analyst (or a manager) may submit.
export async function enterResult(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canSubmitResult(actor.designation))
    return { error: "Not permitted to submit results." };

  const lotId = String(formData.get("lotId") ?? "");
  const valueRaw = String(formData.get("resultValue") ?? "").trim();
  if (!valueRaw) return { error: "Enter a result value." };
  const value = parseFloat(valueRaw);
  if (Number.isNaN(value)) return { error: "Result must be a number." };

  const lot = await prisma.qcLot.findUnique({
    where: { id: lotId },
    include: { productType: true },
  });
  if (!lot) return { error: "Lot not found." };

  // An analyst may only submit for a lot assigned to them; managers may submit any.
  const isManager = canManageProductionQc(actor.designation);
  if (!isManager && lot.assignedToId !== actor.id)
    return { error: "This sample is not assigned to you." };

  const verdict = judge(value, lot.productType.specMin, lot.productType.specMax);

  await prisma.qcLot.update({
    where: { id: lotId },
    data: {
      resultValue: value,
      verdict,
      status: "SUBMITTED",
      testedById: actor.id,
      testedAt: new Date(),
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "QcLot",
    entityId: lotId,
    after: { resultValue: value, verdict, status: "SUBMITTED" },
    facilityId: lot.facilityId,
  });
  await publish({
    template: "qcResultSubmitted",
    params: { lotNo: lot.lotNo, lotId },
    actor,
    facilityId: lot.facilityId,
  });

  revalidatePath("/btf-qc");
  revalidatePath(`/btf-qc/${lotId}`);
  return {};
}

// Lab Manager (re)assigns a booked lot to an analyst.
export async function reassignLot(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageProductionQc(actor.designation))
    throw new Error("Not permitted to assign samples.");

  const lotId = String(formData.get("lotId"));
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  if (assignedToId && !(await isRykAnalyst(assignedToId)))
    throw new Error("Assignee must be an active RYK analyst.");

  const lot = await prisma.qcLot.findUnique({ where: { id: lotId } });
  if (!lot) throw new Error("Lot not found.");

  await prisma.qcLot.update({ where: { id: lotId }, data: { assignedToId } });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "QcLot",
    entityId: lotId,
    after: { assignedToId },
    facilityId: lot.facilityId,
  });
  revalidatePath("/btf-qc");
  revalidatePath(`/btf-qc/${lotId}`);
}

// Approve or reject a tested lot.
export async function decideLot(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveLot(actor.designation))
    throw new Error("Not permitted to approve lots.");

  const lotId = String(formData.get("lotId"));
  const decision = String(formData.get("decision"));
  const status = decision === "APPROVED" ? "APPROVED" : "REJECTED";

  const lot = await prisma.qcLot.findUnique({ where: { id: lotId } });
  if (!lot) throw new Error("Lot not found.");
  if (lot.status !== "SUBMITTED")
    throw new Error("Only a submitted result can be reviewed.");

  await prisma.qcLot.update({
    where: { id: lotId },
    data: { status, approvedById: actor.id, approvedAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "QcLot",
    entityId: lotId,
    after: { status },
    facilityId: lot.facilityId,
  });
  await publish({
    template: "qcLotDecided",
    params: { lotNo: lot.lotNo, lotId, status },
    actor,
    facilityId: lot.facilityId,
    to: [lot.assignedToId, lot.testedById],
  });

  revalidatePath("/btf-qc");
  revalidatePath(`/btf-qc/${lotId}`);
}

// Set a product's acceptance spec (min/max) for auto pass/fail.
export async function setProductSpec(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageProductionQc(actor.designation))
    throw new Error("Not permitted to edit specs.");

  const productTypeId = String(formData.get("productTypeId"));
  const minRaw = String(formData.get("specMin") ?? "").trim();
  const maxRaw = String(formData.get("specMax") ?? "").trim();

  await prisma.productType.update({
    where: { id: productTypeId },
    data: {
      specMin: minRaw ? parseFloat(minRaw) : null,
      specMax: maxRaw ? parseFloat(maxRaw) : null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "ProductType",
    entityId: productTypeId,
    after: { specMin: minRaw || null, specMax: maxRaw || null },
  });

  revalidatePath("/btf-qc");
}
