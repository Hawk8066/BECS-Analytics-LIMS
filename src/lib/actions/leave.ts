"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canApproveLeave } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { publish } from "@/lib/feed/publish";

export type FormState = { error?: string };

const LeaveSchema = z
  .object({
    type: z.enum(["ANNUAL", "CASUAL", "SICK", "OTHER"]),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    reason: z.string().optional(),
  })
  .refine((d) => new Date(d.fromDate) <= new Date(d.toDate), {
    message: "From date must be on or before to date",
    path: ["toDate"],
  });

// Apply for leave — applications only, no quota tracking (BR-20).
export async function applyLeave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const parsed = LeaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const leave = await prisma.leaveApplication.create({
    data: {
      userId: actor.id,
      type: d.type,
      fromDate: new Date(d.fromDate),
      toDate: new Date(d.toDate),
      reason: d.reason || null,
      facilityId: actor.facilityId,
      sectionId: actor.sectionId,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "LeaveApplication",
    entityId: leave.id,
    after: { type: d.type, status: "PENDING" },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });
  const applicant = await prisma.personnelProfile.findUnique({
    where: { userId: actor.id },
    select: { fullName: true },
  });
  await publish({
    template: "leaveApplied",
    params: { who: applicant?.fullName ?? actor.email, type: String(d.type) },
    actor,
  });

  revalidatePath("/app/leave");
  return {};
}

// Approver decides a leave application.
export async function decideLeave(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveLeave(actor.designation))
    throw new Error("Not permitted to decide leave.");

  const id = String(formData.get("leaveId"));
  const decision = String(formData.get("decision"));
  if (decision !== "APPROVED" && decision !== "REJECTED")
    throw new Error("Invalid decision.");

  const leave = await prisma.leaveApplication.update({
    where: { id },
    data: { status: decision, approverId: actor.id, decidedAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "LeaveApplication",
    entityId: id,
    after: { status: decision },
    facilityId: leave.facilityId,
    sectionId: leave.sectionId,
  });
  const applicant = await prisma.personnelProfile.findUnique({
    where: { userId: leave.userId },
    select: { fullName: true },
  });
  await publish({
    template: "leaveDecided",
    params: { who: applicant?.fullName ?? "An employee", status: decision },
    actor,
    facilityId: leave.facilityId,
    sectionId: leave.sectionId,
    to: [leave.userId],
  });

  revalidatePath("/app/leave");
}
