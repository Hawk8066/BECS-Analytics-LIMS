"use server";

import { z } from "zod";
import { hash } from "argon2";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterOutsourceLab } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = {
  error?: string;
  ok?: boolean;
  // Portal credentials to hand to the lab's representative (shown once).
  loginEmail?: string;
  tempPassword?: string;
};

const OutsourceLabSchema = z.object({
  name: z.string().min(2, "Lab name is required"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  // Required — becomes the representative's portal login.
  email: z.string().email("A valid email is required (the representative's login)"),
});

// Register an outsourced (subcontractor) laboratory. Creates the lab plus a
// portal login for its representative, mirroring client/vendor registration.
export async function createOutsourceLab(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterOutsourceLab(actor.designation))
    return { error: "Not permitted to register outsourced labs." };

  const parsed = OutsourceLabSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const email = d.email.trim().toLowerCase();
  // The email is the portal login — it must be unique across all users.
  if (await prisma.user.findUnique({ where: { email } }))
    return { error: "That email is already registered to a user." };

  // A section is required on the user record; use one from the actor's facility.
  const section = await prisma.section.findFirst({
    where: { facilityId: actor.facilityId },
  });
  if (!section) return { error: "No section configured for your facility." };

  const labNo = await nextNumber({ key: "OUTSOURCE_LAB", prefix: "OSL", pad: 5 });
  const tempPassword = randomBytes(6).toString("base64url"); // ~8 chars, one-time
  const passwordHash = await hash(tempPassword);

  const lab = await prisma.outsourceLab.create({
    data: {
      labNo,
      name: d.name,
      addressLine1: d.addressLine1 || null,
      addressLine2: d.addressLine2 || null,
      addressLine3: d.addressLine3 || null,
      city: d.city || null,
      province: d.province || null,
      country: d.country || null,
      contactPerson: d.contactPerson || null,
      contactNumber: d.contactNumber || null,
      email,
      facilityId: actor.facilityId,
      createdById: actor.id,
      // Representative portal login (OUTSOURCE_LAB — sees only outsourced tests).
      portalUsers: {
        create: {
          email,
          passwordHash,
          status: "ACTIVE",
          designation: "OUTSOURCE_LAB",
          facilityId: actor.facilityId,
          sectionId: section.id,
        },
      },
    },
    include: { portalUsers: true },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "OutsourceLab",
    entityId: lab.id,
    after: { labNo, name: d.name, portalLogin: email },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/outsource-labs");
  return { ok: true, loginEmail: email, tempPassword };
}
