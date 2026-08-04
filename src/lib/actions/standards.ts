"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageStandards } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

export type FormState = { error?: string; ok?: boolean };

/** A number field from the form; blank ⇒ null; throws on non-numeric. */
function toNum(raw: FormDataEntryValue | null, label: string): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  return n;
}

const StandardSchema = z.object({
  name: z.string().min(2, "Standard name is required"),
  matrix: z.string().optional(),
  description: z.string().optional(),
});

// Create a standard (a named set of per-parameter acceptance limits). For each
// ticked parameter the form submits limit_<id>_min / limit_<id>_max.
export async function createStandard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageStandards(actor.designation))
    return { error: "Not permitted to manage standards." };

  const parsed = StandardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const matrix = d.matrix?.trim() || null;

  const parameterIds = formData.getAll("parameterIds").map(String).filter(Boolean);
  if (parameterIds.length === 0)
    return { error: "Select at least one parameter and set its limit." };

  // Build a limit per ticked parameter; each needs at least one bound.
  const limits: { parameterId: string; min: number | null; max: number | null }[] = [];
  try {
    for (const parameterId of parameterIds) {
      const min = toNum(formData.get(`limit_${parameterId}_min`), "Min");
      const max = toNum(formData.get(`limit_${parameterId}_max`), "Max");
      if (min === null && max === null) continue; // no bound ⇒ skip
      if (min !== null && max !== null && min > max)
        return { error: "A limit's min cannot exceed its max." };
      limits.push({ parameterId, min, max });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid limit." };
  }
  if (limits.length === 0)
    return { error: "Set a min and/or max on at least one parameter." };

  if (await prisma.standard.findUnique({ where: { name: d.name } }))
    return { error: "A standard with that name already exists." };

  const std = await prisma.standard.create({
    data: {
      name: d.name,
      matrix,
      description: d.description?.trim() || null,
      createdById: actor.id,
      limits: { create: limits },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Standard",
    entityId: std.id,
    after: { name: d.name, matrix, limits: limits.length },
  });
  revalidatePath("/app/parameters");
  return { ok: true };
}

// Add or update one parameter's limit on a standard (blank min & max removes it).
export async function setStandardLimit(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStandards(actor.designation))
    throw new Error("Not permitted to manage standards.");

  const standardId = String(formData.get("standardId"));
  const parameterId = String(formData.get("parameterId"));
  const min = toNum(formData.get("min"), "Min");
  const max = toNum(formData.get("max"), "Max");
  if (min !== null && max !== null && min > max)
    throw new Error("Min cannot exceed max.");

  if (min === null && max === null) {
    await prisma.standardLimit.deleteMany({ where: { standardId, parameterId } });
  } else {
    await prisma.standardLimit.upsert({
      where: { standardId_parameterId: { standardId, parameterId } },
      update: { min, max },
      create: { standardId, parameterId, min, max },
    });
  }
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Standard",
    entityId: standardId,
    after: { parameterId, min, max },
  });
  revalidatePath("/app/parameters");
}

// Remove one parameter's limit from a standard.
export async function removeStandardLimit(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStandards(actor.designation))
    throw new Error("Not permitted to manage standards.");

  const id = String(formData.get("limitId"));
  const limit = await prisma.standardLimit.findUnique({ where: { id } });
  if (!limit) return;
  await prisma.standardLimit.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "Standard",
    entityId: limit.standardId,
    after: { removedParameterId: limit.parameterId },
  });
  revalidatePath("/app/parameters");
}

// Delete a standard (and its limits, via cascade). Blocked if in use by a sample.
export async function deleteStandard(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStandards(actor.designation))
    throw new Error("Not permitted to manage standards.");

  const id = String(formData.get("standardId"));
  const inUse = await prisma.sample.count({ where: { standardId: id } });
  if (inUse > 0)
    throw new Error(`This standard is used by ${inUse} sample(s) and can't be deleted.`);

  await prisma.standard.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "Standard",
    entityId: id,
  });
  revalidatePath("/app/parameters");
}
