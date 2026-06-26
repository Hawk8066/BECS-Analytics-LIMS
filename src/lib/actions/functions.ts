"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canApproveFunction, canManageFunctions } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

export type FormState = { error?: string };

const FunctionSchema = z.object({
  code: z
    .string()
    .min(2)
    .regex(/^[A-Z0-9_]+$/, "Use UPPER_SNAKE_CASE (A–Z, 0–9, _)"),
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
});

// OM (or COO) creates a function. OM-created functions await COO approval;
// COO-created functions are auto-approved (SSOT §5/§6).
export async function createFunction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageFunctions(actor.designation))
    return { error: "Only the OM or COO can create functions." };

  const parsed = FunctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (await prisma.function.findUnique({ where: { code: d.code } }))
    return { error: "A function with that code already exists." };

  const approvedAt = actor.designation === "COO" ? new Date() : null;
  const fn = await prisma.function.create({
    data: {
      code: d.code,
      name: d.name,
      description: d.description || null,
      approvedAt,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Function",
    entityId: fn.id,
    after: { code: d.code, approved: !!approvedAt },
  });

  revalidatePath("/app/functions");
  redirect("/app/functions");
}

// COO approves an OM-created function.
export async function approveFunction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveFunction(actor.designation))
    throw new Error("Only the COO can approve functions.");

  const id = String(formData.get("functionId"));
  await prisma.function.update({
    where: { id },
    data: { approvedAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "Function",
    entityId: id,
    after: { approved: true },
  });

  revalidatePath("/app/functions");
}
