"use server";

import { ItemCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canApprovePR, canVerifyPR } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { pathForCategory } from "@/lib/procurement/path";

export type FormState = { error?: string };

const VALID_CATEGORIES = Object.values(ItemCategory) as string[];

// Any employee raises a PR (SSOT §5). Lines carry their own path (D10/BR-18).
export async function createPR(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();

  const descriptions = formData.getAll("description").map(String);
  const specifications = formData.getAll("specification").map(String);
  const categories = formData.getAll("category").map(String);
  const packSizes = formData.getAll("packSize").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const units = formData.getAll("unit").map(String);
  const justifications = formData.getAll("justification").map(String);
  const priorities = formData.getAll("priority").map(String);

  const lines: {
    description: string;
    specification: string | null;
    category: ItemCategory;
    path: ReturnType<typeof pathForCategory>;
    packSize: string | null;
    quantity: number;
    unit: string | null;
    justification: string | null;
    priority: string | null;
  }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    if (!description) continue;
    const category = categories[i];
    if (!VALID_CATEGORIES.includes(category)) continue;
    lines.push({
      description,
      specification: specifications[i]?.trim() || null,
      category: category as ItemCategory,
      path: pathForCategory(category as ItemCategory),
      packSize: packSizes[i]?.trim() || null,
      quantity: parseInt(quantities[i] || "1", 10) || 1,
      unit: units[i]?.trim() || null,
      justification: justifications[i]?.trim() || null,
      priority: priorities[i]?.trim() || null,
    });
  }
  if (lines.length === 0) return { error: "Add at least one line item." };

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  const year = new Date().getFullYear();
  const prNo = await nextNumber({
    key: `PR:${facility!.code}:${year}`,
    prefix: `PR-${facility!.code}`,
    year,
    pad: 5,
  });

  const pr = await prisma.purchaseRequest.create({
    data: {
      prNo,
      requestedById: actor.id,
      note: String(formData.get("note") || "").trim() || null,
      facilityId: actor.facilityId,
      sectionId: actor.sectionId,
      lines: { create: lines },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "PurchaseRequest",
    entityId: pr.id,
    after: { prNo, lines: lines.length },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/procurement");
  redirect(`/app/procurement/${pr.id}`);
}

// OM @ Lahore / Lab Manager @ RYK verifies (D18).
export async function verifyPR(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canVerifyPR(actor.designation))
    throw new Error("Not permitted to verify PRs.");

  const id = String(formData.get("prId"));
  const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "SUBMITTED") throw new Error("PR is not awaiting verification.");

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "VERIFIED", verifiedById: actor.id, verifiedAt: new Date() },
  });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "PurchaseRequest",
    entityId: id,
    after: { status: "VERIFIED" },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${id}`);
}

// COO approves (SSOT §5, BR-1).
export async function approvePR(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApprovePR(actor.designation))
    throw new Error("Only the COO can approve PRs.");

  const id = String(formData.get("prId"));
  const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "VERIFIED") throw new Error("PR must be verified first.");

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() },
  });
  await prisma.signature.create({
    data: {
      signerId: actor.id,
      subjectType: "PurchaseRequest",
      subjectId: id,
      meaning: "approved",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "PurchaseRequest",
    entityId: id,
    after: { status: "APPROVED" },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${id}`);
}

// Verifier or COO rejects.
export async function rejectPR(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canVerifyPR(actor.designation))
    throw new Error("Not permitted to reject PRs.");

  const id = String(formData.get("prId"));
  const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!pr) throw new Error("PR not found.");

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  await writeAudit({
    actorId: actor.id,
    action: "REJECT",
    entityType: "PurchaseRequest",
    entityId: id,
    after: { status: "REJECTED" },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${id}`);
}
