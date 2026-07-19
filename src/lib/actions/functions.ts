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
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  minExperienceYears: z
    .number()
    .min(0)
    .max(50)
    .nullable()
    .refine((v) => v === null || v % 0.5 === 0, "Use 0.5-year increments"),
});

// OM (or COO) creates a function. OM-created functions await COO approval;
// COO-created functions are auto-approved (SSOT §5/§6). Captures the eligibility
// criteria (education / field / minimum experience) for competence.
export async function createFunction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageFunctions(actor.designation))
    return { error: "Only the OM or COO can create functions." };

  const expRaw = String(formData.get("minExperienceYears") ?? "");
  const parsed = FunctionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    minExperienceYears: expRaw === "" ? null : Number(expRaw),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Multi-select checkboxes → arrays.
  const requiredEducation = formData.getAll("education").map(String).filter(Boolean);
  const requiredFields = formData.getAll("field").map(String).filter(Boolean);
  // "Others" free-text (comma-separated) appended to the subject list.
  const fieldOther = String(formData.get("fieldOther") ?? "").trim();
  if (fieldOther) {
    for (const s of fieldOther.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!requiredFields.includes(s)) requiredFields.push(s);
    }
  }
  // Trainings: one free-text input per row.
  const requiredTrainings = formData
    .getAll("training")
    .map((t) => String(t).trim())
    .filter(Boolean);

  // Auto-generate the code: BECS/602/Functions/<NNNN> with a gap-free,
  // concurrency-safe serial.
  const seq = await prisma.sequence.upsert({
    where: { key: "FUNCTION" },
    update: { counter: { increment: 1 } },
    create: { key: "FUNCTION", prefix: "BECS/602/Functions", counter: 1 },
  });
  const code = `BECS/602/Functions/${String(seq.counter).padStart(4, "0")}`;

  const approvedAt = actor.designation === "COO" ? new Date() : null;
  const fn = await prisma.function.create({
    data: {
      code,
      name: d.name,
      description: d.description || null,
      requiredEducation,
      requiredFields,
      requiredTrainings,
      minExperienceYears: d.minExperienceYears,
      approvedAt,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Function",
    entityId: fn.id,
    after: { code, approved: !!approvedAt },
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
