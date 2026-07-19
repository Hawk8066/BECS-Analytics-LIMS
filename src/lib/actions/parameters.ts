"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageParameters, canApproveParameter } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

export type FormState = { error?: string; ok?: boolean };

const ParameterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().optional(),
  matrix: z.string().optional(),
  method: z.string().optional(),
  lod: z.string().optional(),
  loq: z.string().optional(),
  accredited: z.enum(["on", "true"]).optional(),
});

// Propose a parameter (OM / LO / Lab Manager). COO-created ones are auto-approved.
export async function createParameter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    return { error: "Not permitted to add parameters." };

  const parsed = ParameterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const matrix = d.matrix || null;
  if (await prisma.parameter.findFirst({ where: { name: d.name, matrix } }))
    return { error: "A parameter with that name and matrix already exists." };

  const approvedAt = canApproveParameter(actor.designation) ? new Date() : null;
  const p = await prisma.parameter.create({
    data: {
      name: d.name,
      unit: d.unit || null,
      matrix,
      method: d.method || null,
      lod: d.lod || null,
      loq: d.loq || null,
      accredited: !!d.accredited,
      createdById: actor.id,
      approvedAt,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Parameter",
    entityId: p.id,
    after: { name: d.name, approved: !!approvedAt },
  });

  revalidatePath("/app/parameters");
  return { ok: true };
}

// PKR rupees string → paisa; "" ⇒ null (unset); throws on invalid.
function toPaisa(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const rupees = Number(s);
  if (Number.isNaN(rupees) || rupees < 0) throw new Error("Invalid price.");
  return Math.round(rupees * 100);
}

// Set a parameter's price for a given sector (empty clears it). Sector-based.
export async function updateParameterSectorPrice(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    throw new Error("Not permitted to set prices.");

  const parameterId = String(formData.get("parameterId"));
  const sector = String(formData.get("sector"));
  const price = toPaisa(formData.get("price"));

  if (price === null) {
    await prisma.parameterSectorPrice.deleteMany({ where: { parameterId, sector } });
  } else {
    await prisma.parameterSectorPrice.upsert({
      where: { parameterId_sector: { parameterId, sector } },
      update: { price },
      create: { parameterId, sector, price },
    });
  }
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "ParameterSectorPrice",
    entityId: parameterId,
    after: { sector, price },
  });
  revalidatePath("/app/parameters");
}

// Create a package (a named bundle of selected parameters).
export async function createPackage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    return { error: "Not permitted to create packages." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Package name is required." };
  const parameterIds = formData.getAll("parameterIds").map(String).filter(Boolean);
  if (parameterIds.length === 0)
    return { error: "Select at least one parameter." };

  if (await prisma.package.findUnique({ where: { name } }))
    return { error: "A package with that name already exists." };

  const pkg = await prisma.package.create({
    data: {
      name,
      createdById: actor.id,
      parameters: { create: parameterIds.map((parameterId) => ({ parameterId })) },
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Package",
    entityId: pkg.id,
    after: { name, parameters: parameterIds.length },
  });
  revalidatePath("/app/parameters");
  return { ok: true };
}

// Set a package's price for a given sector (empty clears it).
export async function updatePackageSectorPrice(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    throw new Error("Not permitted to set prices.");

  const packageId = String(formData.get("packageId"));
  const sector = String(formData.get("sector"));
  const price = toPaisa(formData.get("price"));

  if (price === null) {
    await prisma.packageSectorPrice.deleteMany({ where: { packageId, sector } });
  } else {
    await prisma.packageSectorPrice.upsert({
      where: { packageId_sector: { packageId, sector } },
      update: { price },
      create: { packageId, sector, price },
    });
  }
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "PackageSectorPrice",
    entityId: packageId,
    after: { sector, price },
  });
  revalidatePath("/app/parameters");
}

// Delete a package (and its parameter links + sector prices, via cascade).
export async function deletePackage(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    throw new Error("Not permitted to delete packages.");

  const id = String(formData.get("packageId"));
  await prisma.package.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "Package",
    entityId: id,
  });
  revalidatePath("/app/parameters");
}

// COO approves a proposed parameter (makes it selectable for samples).
export async function approveParameter(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveParameter(actor.designation))
    throw new Error("Only the COO can approve parameters.");

  const id = String(formData.get("parameterId"));
  await prisma.parameter.update({
    where: { id },
    data: { approvedAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "Parameter",
    entityId: id,
    after: { approved: true },
  });

  revalidatePath("/app/parameters");
}
