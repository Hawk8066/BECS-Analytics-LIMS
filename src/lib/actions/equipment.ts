"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageEquipment } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { saveFile } from "@/lib/storage";

export type FormState = { error?: string };

const EquipmentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  make: z.string().optional(),
  model: z.string().optional(),
  serialNo: z.string().optional(),
  location: z.string().optional(),
});

// Register equipment; assigns an asset tag (SSOT §11).
export async function registerEquipment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageEquipment(actor.designation))
    return { error: "Not permitted to register equipment." };

  const parsed = EquipmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  const assetTag = await nextNumber({
    key: `EQUIP:${facility!.code}`,
    prefix: `EQ-${facility!.code}`,
    pad: 4,
  });

  const eq = await prisma.equipment.create({
    data: {
      assetTag,
      name: d.name,
      make: d.make || null,
      model: d.model || null,
      serialNo: d.serialNo || null,
      location: d.location || null,
      facilityId: actor.facilityId,
      sectionId: actor.sectionId,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Equipment",
    entityId: eq.id,
    after: { assetTag, name: d.name },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/equipment");
  redirect(`/app/equipment/${eq.id}`);
}

const CalibrationSchema = z.object({
  equipmentId: z.string().min(1),
  calibratedOn: z.string().min(1, "Calibration date is required"),
  validUntil: z.string().min(1, "Valid-until date is required"),
  calibratedBy: z.string().optional(),
  note: z.string().optional(),
});

// Record a calibration (+ optional certificate). validUntil drives the validity flag.
export async function addCalibration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageEquipment(actor.designation))
    return { error: "Not permitted." };

  const parsed = CalibrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  if (new Date(d.validUntil) < new Date(d.calibratedOn))
    return { error: "Valid-until must be on or after the calibration date." };

  let certificateAttachmentId: string | null = null;
  const file = formData.get("certificate");
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const { storageKey, sha256 } = await saveFile(buf, {
      dir: `cal-certs/${d.equipmentId}`,
      fileName: file.name,
    });
    const att = await prisma.attachment.create({
      data: {
        ownerType: "CalibrationRecord",
        ownerId: d.equipmentId,
        kind: "CAL_CERT",
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        storageKey,
        sha256,
        uploadedById: actor.id,
        status: "APPROVED",
      },
    });
    certificateAttachmentId = att.id;
  }

  await prisma.calibrationRecord.create({
    data: {
      equipmentId: d.equipmentId,
      calibratedOn: new Date(d.calibratedOn),
      validUntil: new Date(d.validUntil),
      calibratedBy: d.calibratedBy || null,
      note: d.note || null,
      certificateAttachmentId,
      createdById: actor.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "CalibrationRecord",
    entityId: d.equipmentId,
    after: { validUntil: d.validUntil },
  });

  revalidatePath(`/app/equipment/${d.equipmentId}`);
  return {};
}

const QualificationSchema = z.object({
  equipmentId: z.string().min(1),
  type: z.enum(["IQ", "OQ", "PQ"]),
  result: z.enum(["PASS", "FAIL"]),
  performedOn: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});

// Add a qualification, enforcing the IQ -> OQ -> PQ order (D14).
export async function addQualification(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageEquipment(actor.designation))
    return { error: "Not permitted." };

  const parsed = QualificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const quals = await prisma.qualification.findMany({
    where: { equipmentId: d.equipmentId },
  });
  const passed = (t: string) =>
    quals.some((q) => q.type === t && q.result === "PASS");
  if (d.type === "OQ" && !passed("IQ"))
    return { error: "IQ must pass before OQ (IQ → OQ → PQ)." };
  if (d.type === "PQ" && !passed("OQ"))
    return { error: "OQ must pass before PQ (IQ → OQ → PQ)." };

  await prisma.qualification.create({
    data: {
      equipmentId: d.equipmentId,
      type: d.type,
      result: d.result,
      performedOn: new Date(d.performedOn),
      note: d.note || null,
      createdById: actor.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Qualification",
    entityId: d.equipmentId,
    after: { type: d.type, result: d.result },
  });

  revalidatePath(`/app/equipment/${d.equipmentId}`);
  return {};
}
