"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import {
  openRepairCase,
  issueGatePassFor,
  receiveRepairedEquipment,
  inspectRepair,
  closeRepair,
  cancelRepair,
} from "@/lib/equipment/repair";

// Thin wrappers over lib/equipment/repair.ts: parse the form, hand the work to
// the core function, turn its thrown message into a field error the popup can
// show. `ok` lets the popups close themselves.
export type FormState = { error?: string; ok?: boolean };

/** Core functions throw prose; anything else is a bug worth surfacing plainly. */
function asError(e: unknown): FormState {
  return { error: e instanceof Error ? e.message : "Something went wrong." };
}

/** DateInput posts ISO yyyy-mm-dd; blank means "not given". */
function toDate(value: string | undefined): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const RepairSchema = z.object({
  equipmentId: z.string().min(1),
  kind: z.enum(["BREAKDOWN", "MAINTENANCE"]),
  site: z.enum(["ON_SITE", "OFF_SITE"]),
  reason: z.string().min(5, "Describe the fault or the maintenance required"),
  vendorId: z.string().optional(),
  priority: z.string().optional(),
  note: z.string().optional(),
});

export async function requestRepair(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const parsed = RepairSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  let repairId: string;
  try {
    const repair = await openRepairCase(actor, {
      equipmentId: d.equipmentId,
      kind: d.kind,
      site: d.site,
      reason: d.reason,
      vendorId: d.vendorId,
      priority: d.priority,
      note: d.note,
    });
    repairId = repair.id;
  } catch (e) {
    return asError(e);
  }

  revalidatePath(`/app/equipment/${d.equipmentId}`);
  revalidatePath("/app/procurement");
  redirect(`/app/equipment/repairs/${repairId}`);
}

const GatePassSchema = z.object({
  repairId: z.string().min(1),
  vendorId: z.string().optional(),
  outDate: z.string().min(1, "Date of despatch is required"),
  expectedReturnDate: z.string().optional(),
  accessories: z.string().optional(),
  purpose: z.string().optional(),
});

export async function issueGatePass(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const parsed = GatePassSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const outDate = toDate(d.outDate);
  if (!outDate) return { error: "Enter a valid date of despatch." };
  const expected = toDate(d.expectedReturnDate);

  let passId: string;
  try {
    const pass = await issueGatePassFor(actor, {
      repairId: d.repairId,
      vendorId: d.vendorId,
      outDate,
      expectedReturnDate: expected,
      accessories: d.accessories,
      purpose: d.purpose,
    });
    passId = pass.id;
  } catch (e) {
    return asError(e);
  }

  revalidatePath(`/app/equipment/repairs/${d.repairId}`);
  redirect(`/app/equipment/gate-passes/${passId}`);
}

const ReceiveSchema = z.object({
  repairId: z.string().min(1),
  returnedOn: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});

export async function receiveRepair(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const parsed = ReceiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const returnedOn = toDate(d.returnedOn);
  if (!returnedOn) return { error: "Enter a valid date." };

  try {
    await receiveRepairedEquipment(actor, {
      repairId: d.repairId,
      returnedOn,
      note: d.note,
    });
  } catch (e) {
    return asError(e);
  }

  revalidatePath(`/app/equipment/repairs/${d.repairId}`);
  return { ok: true };
}

const InspectSchema = z.object({
  repairId: z.string().min(1),
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  note: z.string().optional(),
});

export async function submitRepairInspection(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const parsed = InspectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  try {
    await inspectRepair(actor, {
      repairId: d.repairId,
      decision: d.decision,
      note: d.note,
    });
  } catch (e) {
    return asError(e);
  }

  revalidatePath(`/app/equipment/repairs/${d.repairId}`);
  return { ok: true };
}

export async function returnRepairToService(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const repairId = String(formData.get("repairId") || "");
  if (!repairId) return { error: "Missing repair." };

  try {
    await closeRepair(actor, { repairId });
  } catch (e) {
    return asError(e);
  }

  revalidatePath(`/app/equipment/repairs/${repairId}`);
  revalidatePath("/app/equipment");
  return { ok: true };
}

export async function cancelRepairRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const repairId = String(formData.get("repairId") || "");
  if (!repairId) return { error: "Missing repair." };

  try {
    await cancelRepair(actor, {
      repairId,
      reason: String(formData.get("reason") || ""),
    });
  } catch (e) {
    return asError(e);
  }

  revalidatePath(`/app/equipment/repairs/${repairId}`);
  revalidatePath("/app/equipment");
  return { ok: true };
}
