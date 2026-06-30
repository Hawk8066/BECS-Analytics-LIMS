"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canEvaluateCompetence, canGrantAuthorization } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

export type FormState = { error?: string };

const CompetenceSchema = z.object({
  subjectId: z.string().min(1),
  functionId: z.string().min(1, "Select a function"),
  competent: z
    .enum(["true", "false"], { message: "Select Competent or Not Competent" }),
  education: z.string().optional(),
  experience: z.string().optional(),
  training: z.string().optional(),
  skills: z.string().optional(),
  remarks: z.string().optional(),
  validUntil: z.string().optional(),
});

// Record a competence evaluation (subject × function). Captures the assessment
// basis (education/experience/training/skills) and a Competent/Not-Competent
// decision; a Competent record is the precondition for authorization (SSOT §6).
export async function recordCompetence(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canEvaluateCompetence(actor.designation))
    return { error: "Not permitted to evaluate competence." };

  const parsed = CompetenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const fn = await prisma.function.findUnique({ where: { id: d.functionId } });
  if (!fn?.approvedAt)
    return { error: "Function must be approved before competence is recorded." };

  const competent = d.competent === "true";

  await prisma.competenceEvaluation.create({
    data: {
      subjectId: d.subjectId,
      functionId: d.functionId,
      evaluatorId: actor.id,
      competent,
      education: d.education || null,
      experience: d.experience || null,
      training: d.training || null,
      skills: d.skills || null,
      remarks: d.remarks || null,
      result: competent ? "Competent" : "Not Competent",
      validUntil: d.validUntil ? new Date(d.validUntil) : null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "CompetenceEvaluation",
    entityId: d.subjectId,
    after: { functionId: d.functionId, competent },
  });

  revalidatePath(`/app/personnel/${d.subjectId}`);
  return {};
}

// COO grants an authorization — only if a competence record exists (SSOT §6).
export async function grantAuthorization(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canGrantAuthorization(actor.designation))
    throw new Error("Only the COO can grant authorizations.");

  const subjectId = String(formData.get("subjectId"));
  const functionId = String(formData.get("functionId"));
  const expiresRaw = formData.get("expiresAt");
  const expiresAt =
    typeof expiresRaw === "string" && expiresRaw ? new Date(expiresRaw) : null;

  // The most recent competence decision for this function must be "Competent".
  const competence = await prisma.competenceEvaluation.findFirst({
    where: { subjectId, functionId },
    orderBy: { evaluatedAt: "desc" },
  });
  if (!competence)
    throw new Error("Competence is required before authorization.");
  if (!competence.competent)
    throw new Error(
      "Latest competence assessment is Not Competent — cannot authorize.",
    );

  await prisma.authorization.upsert({
    where: { subjectId_functionId: { subjectId, functionId } },
    update: {
      status: "ACTIVE",
      grantedById: actor.id,
      effectiveAt: new Date(),
      expiresAt,
    },
    create: { subjectId, functionId, grantedById: actor.id, expiresAt },
  });

  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "Authorization",
    entityId: subjectId,
    after: { functionId, status: "ACTIVE" },
  });

  revalidatePath(`/app/personnel/${subjectId}`);
}

// COO revokes an authorization (closes the Tier-2 gate; SSOT §6).
export async function revokeAuthorization(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canGrantAuthorization(actor.designation))
    throw new Error("Only the COO can revoke authorizations.");

  const id = String(formData.get("authorizationId"));
  const subjectId = String(formData.get("subjectId"));
  await prisma.authorization.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Authorization",
    entityId: id,
    after: { status: "REVOKED" },
  });

  revalidatePath(`/app/personnel/${subjectId}`);
}
