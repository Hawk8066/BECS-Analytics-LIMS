"use server";

import { z } from "zod";
import { hash } from "argon2";
import { Designation, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canApproveProfile,
  canDeactivateUser,
  canManagePersonnel,
  isAdmin,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { publish } from "@/lib/feed/publish";
import { saveFile } from "@/lib/storage";
import { uniqueViolation } from "@/lib/db/errors";

export type FormState = {
  error?: string;
  ok?: boolean;
  /**
   * The field that caused the error, so the form can mark that input invalid
   * instead of only printing a message at the bottom of a long form.
   */
  field?: string;
  /**
   * What was submitted, echoed back so the form can repopulate itself.
   *
   * React 19 resets an uncontrolled form once its action completes, so without
   * this the user would see the error next to twelve blank inputs and have to
   * retype everything — which makes reporting the error inline pointless.
   */
  values?: Record<string, string>;
};

/** Submitted values as plain strings, for echoing back on an error. */
function submitted(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries())
    if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}



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
  // Onboarding is for accounts still working towards ACTIVE. A deactivated user
  // must not be able to POST here and re-enter the approval queue; the page-level
  // branch is cosmetic against a direct request.
  if (actor.status === "NON_ACTIVE")
    return { error: "This account is deactivated." };
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  try {
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
  } catch (e) {
    const dup = uniqueViolation(e);
    if (dup)
      return {
        error: dup.message,
        field: dup.field ?? undefined,
        values: submitted(formData),
      };
    throw e;
  }
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
  const me = await prisma.personnelProfile.findUnique({
    where: { userId: actor.id },
    select: { fullName: true },
  });
  // Before the redirect() below.
  await publish({
    template: "profileSubmitted",
    params: { who: me?.fullName ?? actor.email, userId: actor.id },
    actor,
  });

  revalidatePath("/app");
  redirect("/app/onboarding");
}

const EditProfileSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().min(2, "Full name is required"),
  title: z.string().optional(),
  fatherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  cnic: z.string().optional(),
  contactNumber: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  skills: z.string().optional(),
  dateOfJoining: z.string().optional(),
});

// Edit an existing person's HR profile. Allowed for personnel managers (OM/COO/
// Admin) or the person editing their own record. Does not change account status.
export async function updatePersonnelProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();

  const parsed = EditProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (actor.id !== d.userId && !isAdmin(actor.designation))
    return { error: "Only the profile owner can edit this profile." };

  const target = await prisma.user.findUnique({ where: { id: d.userId } });
  if (!target) return { error: "User not found." };

  const fields = {
    fullName: d.fullName,
    title: d.title || null,
    fatherName: d.fatherName || null,
    dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
    cnic: d.cnic || null,
    contactNumber: d.contactNumber || null,
    bloodGroup: d.bloodGroup || null,
    emergencyContact: d.emergencyContact || null,
    emergencyContactName: d.emergencyContactName || null,
    emergencyContactRelation: d.emergencyContactRelation || null,
    skills: d.skills || null,
    dateOfJoining: d.dateOfJoining ? new Date(d.dateOfJoining) : null,
  };

  try {
    await prisma.personnelProfile.upsert({
      where: { userId: d.userId },
      update: fields,
      create: { userId: d.userId, ...fields },
    });
  } catch (e) {
    const dup = uniqueViolation(e);
    if (dup)
      return {
        error: dup.message,
        field: dup.field ?? undefined,
        values: submitted(formData),
      };
    throw e;
  }

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: d.userId,
    after: { fullName: d.fullName },
    facilityId: target.facilityId,
    sectionId: target.sectionId,
  });

  revalidatePath(`/app/personnel/${d.userId}`);
  return { ok: true };
}

// Resolve the editable profile for a user, enforcing the edit permission.
async function authorizeProfileEdit(userId: string) {
  const actor = await requireUser();
  if (actor.id !== userId && !isAdmin(actor.designation))
    return { error: "Only the profile owner can edit this profile." as string };
  const profile = await prisma.personnelProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile) return { error: "Profile not found." };
  return { actor, profile };
}

const EducationArray = z
  .array(
    z.object({
      id: z.string().nullish(), // existing entry id (preserve files); empty = new
      degreeLevel: z.string().min(1, "Degree level is required"),
      subjects: z.string().nullish(),
      startYear: z.number().int().min(1900).max(2100).nullish(),
      endYear: z.number().int().min(1900).max(2100).nullish(),
    }),
  )
  .max(50);

// Save a person's education entries, PRESERVING ids of existing rows so that
// uploaded degree/transcript attachments (keyed by entry id) survive edits.
export async function saveEducation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = String(formData.get("userId"));
  const auth = await authorizeProfileEdit(userId);
  if ("error" in auth) return { error: auth.error };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("entriesJson") ?? "[]"));
  } catch {
    return { error: "Invalid education data." };
  }
  const parsed = EducationArray.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid education data." };

  const profileId = auth.profile.id;
  const existing = await prisma.educationEntry.findMany({
    where: { profileId },
    select: { id: true },
  });
  const incomingIds = new Set(parsed.data.map((e) => e.id).filter(Boolean));
  const removedIds = existing.map((e) => e.id).filter((id) => !incomingIds.has(id));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  // Remove deleted entries and their attachments.
  if (removedIds.length) {
    ops.push(
      prisma.attachment.deleteMany({
        where: { ownerType: "EducationEntry", ownerId: { in: removedIds } },
      }),
      prisma.educationEntry.deleteMany({ where: { id: { in: removedIds } } }),
    );
  }
  for (const e of parsed.data) {
    const data = {
      degreeLevel: e.degreeLevel,
      subjects: e.subjects || null,
      startYear: e.startYear ?? null,
      endYear: e.endYear ?? null,
    };
    if (e.id) {
      ops.push(
        prisma.educationEntry.update({ where: { id: e.id }, data }),
      );
    } else {
      ops.push(prisma.educationEntry.create({ data: { profileId, ...data } }));
    }
  }
  await prisma.$transaction(ops);

  await writeAudit({
    actorId: auth.actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: userId,
    after: { educationEntries: parsed.data.length },
    facilityId: auth.profile.user.facilityId,
    sectionId: auth.profile.user.sectionId,
  });

  revalidatePath(`/app/personnel/${userId}`);
  return { ok: true };
}

const ExperienceArray = z
  .array(
    z.object({
      company: z.string().min(1, "Company is required"),
      designation: z.string().nullish(),
      startDate: z.string().nullish(),
      endDate: z.string().nullish(),
    }),
  )
  .max(50);

// Replace a person's structured work-experience entries (multi-row editor).
export async function saveExperience(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = String(formData.get("userId"));
  const auth = await authorizeProfileEdit(userId);
  if ("error" in auth) return { error: auth.error };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("entriesJson") ?? "[]"));
  } catch {
    return { error: "Invalid experience data." };
  }
  const parsed = ExperienceArray.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid experience data." };

  const profileId = auth.profile.id;
  await prisma.$transaction([
    prisma.experienceEntry.deleteMany({ where: { profileId } }),
    prisma.experienceEntry.createMany({
      data: parsed.data.map((e) => ({
        profileId,
        company: e.company,
        designation: e.designation || null,
        startDate: e.startDate ? new Date(e.startDate) : null,
        endDate: e.endDate ? new Date(e.endDate) : null,
      })),
    }),
  ]);

  await writeAudit({
    actorId: auth.actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: userId,
    after: { experienceEntries: parsed.data.length },
    facilityId: auth.profile.user.facilityId,
    sectionId: auth.profile.user.sectionId,
  });

  revalidatePath(`/app/personnel/${userId}`);
  return { ok: true };
}

const TrainingArray = z
  .array(
    z.object({
      title: z.string().min(1, "Title is required"),
      year: z.number().int().min(1900).max(2100).nullish(),
    }),
  )
  .max(100);

// Replace a person's structured training entries (multi-row editor).
export async function saveTrainings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = String(formData.get("userId"));
  const auth = await authorizeProfileEdit(userId);
  if ("error" in auth) return { error: auth.error };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("entriesJson") ?? "[]"));
  } catch {
    return { error: "Invalid training data." };
  }
  const parsed = TrainingArray.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid training data." };

  const profileId = auth.profile.id;
  await prisma.$transaction([
    prisma.trainingEntry.deleteMany({ where: { profileId } }),
    prisma.trainingEntry.createMany({
      data: parsed.data.map((t) => ({
        profileId,
        title: t.title,
        year: t.year ?? null,
      })),
    }),
  ]);

  await writeAudit({
    actorId: auth.actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: userId,
    after: { trainingEntries: parsed.data.length },
    facilityId: auth.profile.user.facilityId,
    sectionId: auth.profile.user.sectionId,
  });

  revalidatePath(`/app/personnel/${userId}`);
  return { ok: true };
}

const PublicationArray = z
  .array(
    z.object({
      title: z.string().min(1, "Title is required"),
      journal: z.string().nullish(),
      year: z.number().int().min(1900).max(2100).nullish(),
      impactFactor: z.number().min(0).max(1000).nullish(),
    }),
  )
  .max(200);

// Replace a person's structured publication entries (multi-row editor).
export async function savePublications(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = String(formData.get("userId"));
  const auth = await authorizeProfileEdit(userId);
  if ("error" in auth) return { error: auth.error };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("entriesJson") ?? "[]"));
  } catch {
    return { error: "Invalid publication data." };
  }
  const parsed = PublicationArray.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid publication data." };

  const profileId = auth.profile.id;
  await prisma.$transaction([
    prisma.publicationEntry.deleteMany({ where: { profileId } }),
    prisma.publicationEntry.createMany({
      data: parsed.data.map((p) => ({
        profileId,
        title: p.title,
        journal: p.journal || null,
        year: p.year ?? null,
        impactFactor: p.impactFactor ?? null,
      })),
    }),
  ]);

  await writeAudit({
    actorId: auth.actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: userId,
    after: { publicationEntries: parsed.data.length },
    facilityId: auth.profile.user.facilityId,
    sectionId: auth.profile.user.sectionId,
  });

  revalidatePath(`/app/personnel/${userId}`);
  return { ok: true };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Upload (and replace) a person's profile picture. Stored as a polymorphic
// Attachment (ownerType "PersonnelProfile", kind "AVATAR").
export async function uploadProfilePicture(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = String(formData.get("userId"));
  const auth = await authorizeProfileEdit(userId);
  if ("error" in auth) return { error: auth.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose an image to upload." };
  if (!file.type.startsWith("image/"))
    return { error: "Profile picture must be an image." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Image must be under 10 MB." };

  const buf = Buffer.from(await file.arrayBuffer());
  const { storageKey, sha256 } = await saveFile(buf, {
    dir: `avatars/${auth.profile.id}`,
    fileName: file.name,
  });

  await prisma.$transaction([
    prisma.attachment.deleteMany({
      where: { ownerType: "PersonnelProfile", ownerId: auth.profile.id, kind: "AVATAR" },
    }),
    prisma.attachment.create({
      data: {
        ownerType: "PersonnelProfile",
        ownerId: auth.profile.id,
        kind: "AVATAR",
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        storageKey,
        sha256,
        uploadedById: auth.actor.id,
        status: "APPROVED",
      },
    }),
  ]);

  await writeAudit({
    actorId: auth.actor.id,
    action: "UPDATE",
    entityType: "PersonnelProfile",
    entityId: userId,
    after: { avatar: file.name },
    facilityId: auth.profile.user.facilityId,
    sectionId: auth.profile.user.sectionId,
  });

  revalidatePath(`/app/personnel/${userId}`);
  return { ok: true };
}

// Upload (and replace) a degree certificate or transcript for an education entry.
export async function uploadEducationFile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const entryId = String(formData.get("entryId"));
  const kind = String(formData.get("kind")); // "DEGREE" | "TRANSCRIPT"
  if (kind !== "DEGREE" && kind !== "TRANSCRIPT")
    return { error: "Invalid document kind." };

  const entry = await prisma.educationEntry.findUnique({
    where: { id: entryId },
    include: { profile: { include: { user: true } } },
  });
  if (!entry) return { error: "Education entry not found." };

  const actor = await requireUser();
  if (actor.id !== entry.profile.userId && !isAdmin(actor.designation))
    return { error: "Only the profile owner can edit this profile." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File must be under 10 MB." };

  const buf = Buffer.from(await file.arrayBuffer());
  const { storageKey, sha256 } = await saveFile(buf, {
    dir: `education/${entryId}`,
    fileName: file.name,
  });

  await prisma.$transaction([
    prisma.attachment.deleteMany({
      where: { ownerType: "EducationEntry", ownerId: entryId, kind },
    }),
    prisma.attachment.create({
      data: {
        ownerType: "EducationEntry",
        ownerId: entryId,
        kind,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        storageKey,
        sha256,
        uploadedById: actor.id,
        status: "APPROVED",
      },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Attachment",
    entityId: entryId,
    after: { kind, fileName: file.name },
    facilityId: entry.profile.user.facilityId,
    sectionId: entry.profile.user.sectionId,
  });

  revalidatePath(`/app/personnel/${entry.profile.userId}`);
  return { ok: true };
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
  const approved = await prisma.personnelProfile.findUnique({
    where: { userId },
    select: { fullName: true },
  });
  await publish({
    template: "profileApproved",
    params: { who: approved?.fullName ?? target.email, userId },
    actor,
    facilityId: target.facilityId,
    sectionId: target.sectionId,
    to: [userId], // approval unblocks the whole app for them
  });

  revalidatePath("/app/personnel");
}

/**
 * Deactivate a staff account, or restore one.
 *
 * `NON_ACTIVE` has existed in the schema since the first migration but nothing
 * ever wrote it — it was reachable only by hand-editing the row in the generic
 * admin panel. BR-12 (schema.prisma, UserStatus) says a resigned person is
 * "retained, never hard-deleted", and the foreign keys enforce it: a staff
 * user's PersonnelProfile, Signatures, Attendance and Authorizations are all
 * ON DELETE RESTRICT, so deletion is not merely discouraged but impossible
 * without destroying the ISO 17025 evidence that makes their signed reports
 * defensible. Deactivation is the offboarding mechanism.
 *
 * Effect is immediate: `getSessionUser` re-reads status from the database on
 * every request, so an open session stops working on the deactivated user's
 * next page load, and `src/auth.ts` refuses a fresh sign-in.
 */
export async function setUserActive(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canDeactivateUser(actor.designation))
    throw new Error("Not permitted to change account status.");

  const userId = String(formData.get("userId") ?? "");
  const activate = String(formData.get("activate") ?? "") === "true";

  // Locking yourself out would need another admin to undo, so refuse it.
  if (userId === actor.id)
    throw new Error("You cannot change the status of your own account.");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      facilityId: true,
      sectionId: true,
      profile: { select: { approvedByCooAt: true } },
    },
  });
  if (!target) throw new Error("User not found.");

  // Reactivating someone who never finished onboarding must not skip approval:
  // send them back to the step they were at rather than straight to ACTIVE.
  const restored = target.profile?.approvedByCooAt ? "ACTIVE" : "PENDING_APPROVAL";
  const status = activate ? restored : "NON_ACTIVE";
  if (status === target.status) return;

  await prisma.user.update({ where: { id: userId }, data: { status } });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    before: { status: target.status },
    after: { status },
    facilityId: target.facilityId,
    sectionId: target.sectionId,
  });

  revalidatePath(`/app/personnel/${userId}`);
  revalidatePath("/app/personnel");
}
