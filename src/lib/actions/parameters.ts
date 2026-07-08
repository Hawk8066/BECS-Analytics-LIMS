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
  price: z.string().optional(), // PKR (rupees)
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

  if (await prisma.parameter.findUnique({ where: { name: d.name } }))
    return { error: "A parameter with that name already exists." };

  // Price entered in PKR rupees → stored as paisa.
  let pricePaisa: number | null = null;
  if (d.price && d.price.trim() !== "") {
    const rupees = Number(d.price);
    if (Number.isNaN(rupees) || rupees < 0)
      return { error: "Price must be a positive number." };
    pricePaisa = Math.round(rupees * 100);
  }

  const approvedAt = canApproveParameter(actor.designation) ? new Date() : null;
  const p = await prisma.parameter.create({
    data: {
      name: d.name,
      unit: d.unit || null,
      matrix: d.matrix || null,
      method: d.method || null,
      lod: d.lod || null,
      loq: d.loq || null,
      accredited: !!d.accredited,
      price: pricePaisa,
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
