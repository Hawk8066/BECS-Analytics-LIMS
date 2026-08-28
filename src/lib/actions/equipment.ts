"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageEquipment } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { facilityByCode } from "@/lib/facilities";

// `ok` lets the popups close themselves once the server confirms the save.
export type FormState = { error?: string; ok?: boolean };

const EquipmentSchema = z.object({
  inventoryItemId: z.string().min(1, "Choose the equipment from the sub-store"),
  serialNo: z.string().optional(),
  location: z.string().min(1, "Location within the store is required"),
  // Calibration is captured at registration; "uncalibrated" is a deliberate
  // choice rather than an empty field left behind.
  uncalibrated: z.string().optional(),
  calibratedOn: z.string().optional(),
  validUntil: z.string().optional(),
  calibratedBy: z.string().optional(), // "INTERNAL" or a vendor id
  certificateNo: z.string().optional(),
});

/**
 * Register equipment; assigns an asset tag (SSOT §11).
 *
 * Equipment is only usable once it has been issued from the main store to a
 * lab's sub-store (BR-10), so the register draws solely from sub-store
 * inventory: the asset is chosen from there rather than typed in, and
 * name/make/model are snapshotted so the register stays readable if the
 * inventory row is later edited. Its first calibration is recorded in the same
 * step.
 */
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

  // Refetch the item server-side: it must be equipment, and it must already sit
  // in a sub-store — an item still in the main store has not been issued to a
  // lab yet, so it cannot be in use.
  const item = await prisma.inventoryItem.findUnique({
    where: { id: d.inventoryItemId },
    select: {
      id: true,
      name: true,
      make: true,
      model: true,
      category: true,
      storeId: true,
      store: { select: { facilityId: true, type: true } },
    },
  });
  if (!item) return { error: "That store item no longer exists." };
  if (item.category !== "EQUIPMENT")
    return { error: "Only equipment-category store items can be registered." };
  if (item.store.type !== "SUB")
    return {
      error:
        "That item is still in the main store — issue it to the lab's sub-store before registering it.",
    };

  // The asset belongs to the lab whose store carries it — not to whoever is
  // typing — so the two registers stay separate even for cross-lab staff.
  const facilityId = item.store.facilityId;
  if (!actor.canReadCrossSection && facilityId !== actor.facilityId)
    return { error: "That store belongs to another lab." };
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: { code: true },
  });
  if (!facility) return { error: "That store's lab no longer exists." };
  const route = facilityByCode(facility.code);
  const labSection = route
    ? await prisma.section.findUnique({
        where: { type: route.section },
        select: { id: true },
      })
    : null;
  const sectionId = labSection?.id ?? actor.sectionId;

  const calibrator = await resolveCalibrator(d.calibratedBy);
  if (!calibrator) return { error: "That vendor is no longer registered." };

  const uncalibrated = d.uncalibrated === "on";
  let calibratedOn: Date | null = null;
  let validUntil: Date | null = null;
  if (!uncalibrated) {
    if (!d.calibratedOn || !d.validUntil)
      return {
        error:
          "Enter both calibration dates, or tick “not calibrated yet” if it is still due.",
      };
    calibratedOn = new Date(d.calibratedOn);
    validUntil = new Date(d.validUntil);
    if (Number.isNaN(calibratedOn.getTime()) || Number.isNaN(validUntil.getTime()))
      return { error: "Enter valid calibration dates." };
    if (validUntil < calibratedOn)
      return { error: "Valid-until must be on or after the calibration date." };
  }

  // Asset tags are numbered per lab, so the tag follows the owning facility.
  const assetTag = await nextNumber({
    key: `EQUIP:${facility.code}`,
    prefix: `EQ-${facility.code}`,
    pad: 4,
  });

  const eq = await prisma.equipment.create({
    data: {
      assetTag,
      name: item.name,
      make: item.make,
      model: item.model,
      serialNo: d.serialNo || null,
      storeId: item.storeId,
      inventoryItemId: item.id,
      location: d.location,
      facilityId,
      sectionId,
      ...(calibratedOn && validUntil
        ? {
            calibrations: {
              create: {
                calibratedOn,
                validUntil,
                vendorId: calibrator.vendorId,
                calibratedBy: calibrator.calibratedBy,
                certificateNo: d.certificateNo?.trim() || null,
                createdById: actor.id,
              },
            },
          }
        : {}),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Equipment",
    entityId: eq.id,
    after: {
      assetTag,
      name: item.name,
      storeId: item.storeId,
      location: d.location,
      calibratedOn: d.calibratedOn ?? null,
      validUntil: d.validUntil ?? null,
    },
    facilityId,
    sectionId,
  });

  if (route) revalidatePath(`/app/equipment/${route.slug}`);
  redirect(`/app/equipment/${eq.id}`);
}

const CalibrationSchema = z.object({
  equipmentId: z.string().min(1),
  calibratedOn: z.string().min(1, "Calibration date is required"),
  validUntil: z.string().min(1, "Valid-until date is required"),
  // "INTERNAL", or a vendor id from the registered vendor list.
  calibratedBy: z.string().optional(),
  certificateNo: z.string().optional(),
  note: z.string().optional(),
});

/**
 * Who performed a calibration. The form posts either the sentinel "INTERNAL" or
 * a vendor id; the vendor's name is snapshotted alongside the link so an old
 * record still reads correctly if that vendor is later renamed.
 */
async function resolveCalibrator(
  value: string | undefined,
): Promise<{ vendorId: string | null; calibratedBy: string | null } | null> {
  const v = (value ?? "").trim();
  if (!v) return { vendorId: null, calibratedBy: null };
  if (v === "INTERNAL") return { vendorId: null, calibratedBy: "Internal" };
  const vendor = await prisma.vendor.findUnique({
    where: { id: v },
    select: { id: true, company: true },
  });
  if (!vendor) return null;
  return { vendorId: vendor.id, calibratedBy: vendor.company };
}

// Record a calibration. validUntil drives the validity flag; the certificate is
// captured by number rather than uploaded.
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

  const calibrator = await resolveCalibrator(d.calibratedBy);
  if (!calibrator) return { error: "That vendor is no longer registered." };

  await prisma.calibrationRecord.create({
    data: {
      equipmentId: d.equipmentId,
      calibratedOn: new Date(d.calibratedOn),
      validUntil: new Date(d.validUntil),
      vendorId: calibrator.vendorId,
      calibratedBy: calibrator.calibratedBy,
      certificateNo: d.certificateNo?.trim() || null,
      note: d.note || null,
      createdById: actor.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "CalibrationRecord",
    entityId: d.equipmentId,
    after: {
      validUntil: d.validUntil,
      calibratedBy: calibrator.calibratedBy,
      certificateNo: d.certificateNo ?? null,
    },
  });

  revalidatePath(`/app/equipment/${d.equipmentId}`);
  return { ok: true };
}

const QualificationSchema = z.object({
  equipmentId: z.string().min(1),
  type: z.enum(["IQ", "OQ", "PQ"]),
  result: z.enum(["PASS", "FAIL"]),
  performedOn: z.string().min(1, "Date is required"),
  note: z.string().optional(),
  // Set when this is the requalification of a repair (Module 05 §5.2).
  repairId: z.string().optional(),
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

  // A repair is requalified from scratch: the ordering runs over this repair's
  // own qualifications, not the ones the asset passed when it was commissioned.
  const repairId = d.repairId?.trim() || null;
  if (repairId) {
    const repair = await prisma.equipmentRepair.findUnique({
      where: { id: repairId },
      select: { equipmentId: true },
    });
    if (!repair || repair.equipmentId !== d.equipmentId)
      return { error: "That repair does not belong to this equipment." };
  }

  const quals = await prisma.qualification.findMany({
    where: { equipmentId: d.equipmentId, repairId },
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
      repairId,
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
    after: { type: d.type, result: d.result, repairId },
  });

  revalidatePath(`/app/equipment/${d.equipmentId}`);
  if (repairId) revalidatePath(`/app/equipment/repairs/${repairId}`);
  return { ok: true };
}
