"use server";

import { z } from "zod";
import { MaterialType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageMaterials } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { saveFile } from "@/lib/storage";
import { facilityBySlug } from "@/lib/facilities";

export type FormState = { error?: string };

const TYPES = Object.values(MaterialType) as string[];

const MaterialSchema = z.object({
  type: z.string().refine((v) => TYPES.includes(v), "Invalid type"),
  name: z.string().min(2, "Name is required"),
  lotNo: z.string().optional(),
  certifiedValue: z.string().optional(),
  expiry: z.string().optional(),
  unit: z.string().optional(),
  // Which lab's register this belongs to (the page it was filed from).
  facility: z.string().optional(),
});

export async function registerMaterial(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageMaterials(actor.designation))
    return { error: "Not permitted to manage materials." };

  const parsed = MaterialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Materials are registered per lab, so the record follows the page it was
  // filed from; staff without cross-lab read stay pinned to their own.
  let facilityId = actor.facilityId;
  let sectionId = actor.sectionId;
  const route = d.facility ? facilityBySlug(d.facility) : undefined;
  if (route) {
    const facility = await prisma.facility.findUnique({
      where: { code: route.code },
      select: { id: true },
    });
    if (!facility) return { error: "That lab no longer exists." };
    if (!actor.canReadCrossSection && facility.id !== actor.facilityId)
      return { error: "You can only register materials in your own lab." };
    const section = await prisma.section.findUnique({
      where: { type: route.section },
      select: { id: true },
    });
    facilityId = facility.id;
    sectionId = section?.id ?? actor.sectionId;
  }

  const item = await prisma.materialItem.create({
    data: {
      type: d.type as MaterialType,
      name: d.name,
      lotNo: d.lotNo || null,
      certifiedValue: d.certifiedValue || null,
      expiry: d.expiry ? new Date(d.expiry) : null,
      unit: d.unit || null,
      facilityId,
      sectionId,
      createdById: actor.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "MaterialItem",
    entityId: item.id,
    after: { type: d.type, name: d.name },
    facilityId,
    sectionId,
  });

  if (route) revalidatePath(`/app/materials/${route.slug}`);
  redirect(`/app/materials/${item.id}`);
}

// Attach a certificate (CoA / MSDS / cal cert / reference cert) to a material.
export async function addMaterialAttachment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageMaterials(actor.designation))
    return { error: "Not permitted." };

  const materialId = String(formData.get("materialId"));
  const kind = String(formData.get("kind") || "DOC");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a file to upload." };

  const buf = Buffer.from(await file.arrayBuffer());
  const { storageKey, sha256 } = await saveFile(buf, {
    dir: `materials/${materialId}`,
    fileName: file.name,
  });
  await prisma.attachment.create({
    data: {
      ownerType: "MaterialItem",
      ownerId: materialId,
      kind,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      storageKey,
      sha256,
      uploadedById: actor.id,
      status: "APPROVED",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Attachment",
    entityId: materialId,
    after: { kind, fileName: file.name },
  });

  revalidatePath(`/app/materials/${materialId}`);
  return {};
}
