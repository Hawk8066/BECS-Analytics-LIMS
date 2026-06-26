"use server";

import { z } from "zod";
import { hash } from "argon2";
import { Designation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canApproveProfile, canManagePersonnel } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

export type FormState = { error?: string; ok?: boolean };

const designationValues = Object.values(Designation) as string[];

const ShellSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2, "Full name is required"),
  contactNumber: z.string().optional(),
  designation: z
    .string()
    .refine((v) => designationValues.includes(v), "Invalid designation"),
  facilityId: z.string().min(1, "Facility is required"),
  sectionId: z.string().min(1, "Section is required"),
  dateOfJoining: z.string().optional(),
  tempPassword: z.string().min(6, "Temp password must be at least 6 characters"),
});

// OM creates the profile shell (SSOT §5 / Module 01): only the shell fields are
// entered here; the user completes the rest; the COO approves to activate.
export async function createPersonnelShell(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManagePersonnel(actor.designation))
    return { error: "Only the OM or COO can create personnel." };

  const parsed = ShellSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (await prisma.user.findUnique({ where: { email: d.email } }))
    return { error: "A user with that email already exists." };

  const passwordHash = await hash(d.tempPassword);
  const user = await prisma.user.create({
    data: {
      email: d.email,
      passwordHash,
      status: "PENDING_PROFILE",
      designation: d.designation as Designation,
      facilityId: d.facilityId,
      sectionId: d.sectionId,
      profile: {
        create: {
          fullName: d.fullName,
          contactNumber: d.contactNumber || null,
          dateOfJoining: d.dateOfJoining ? new Date(d.dateOfJoining) : null,
        },
      },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    after: { email: d.email, designation: d.designation, status: "PENDING_PROFILE" },
    facilityId: d.facilityId,
    sectionId: d.sectionId,
  });

  revalidatePath("/app/personnel");
  redirect("/app/personnel");
}

const ProfileSchema = z.object({
  title: z.string().optional(),
  fatherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  cnic: z.string().optional(),
  contactNumber: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContact: z.string().optional(),
  education: z.string().optional(),
  experience: z.string().optional(),
  publications: z.string().optional(),
  trainings: z.string().optional(),
  skills: z.string().optional(),
});

// The user completes their own profile, moving to PENDING_APPROVAL (SSOT §5).
export async function completeOwnProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  await prisma.personnelProfile.update({
    where: { userId: actor.id },
    data: {
      title: d.title || null,
      fatherName: d.fatherName || null,
      dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
      cnic: d.cnic || null,
      contactNumber: d.contactNumber || null,
      bloodGroup: d.bloodGroup || null,
      emergencyContact: d.emergencyContact || null,
      education: d.education || null,
      experience: d.experience || null,
      publications: d.publications || null,
      trainings: d.trainings || null,
      skills: d.skills || null,
      completedByUserAt: new Date(),
    },
  });
  await prisma.user.update({
    where: { id: actor.id },
    data: { status: "PENDING_APPROVAL" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: actor.id,
    after: { status: "PENDING_APPROVAL" },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app");
  redirect("/app/onboarding");
}

// COO approves a profile, activating the account (SSOT §5, BR-1). Records a
// signature (meaning: approved) and an audit entry.
export async function approveProfile(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveProfile(actor.designation))
    throw new Error("Only the COO can approve profiles.");

  const userId = String(formData.get("userId"));
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("User not found.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } }),
    prisma.personnelProfile.update({
      where: { userId },
      data: { approvedByCooAt: new Date() },
    }),
    prisma.signature.create({
      data: {
        signerId: actor.id,
        subjectType: "PersonnelProfile",
        subjectId: userId,
        meaning: "approved",
      },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "User",
    entityId: userId,
    after: { status: "ACTIVE" },
    facilityId: target.facilityId,
    sectionId: target.sectionId,
  });

  revalidatePath("/app/personnel");
}
