"use server";

import { z } from "zod";
import { hash } from "argon2";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterClient } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = {
  error?: string;
  ok?: boolean;
  // Portal credentials to hand to the client (shown once on success).
  loginEmail?: string;
  tempPassword?: string;
};

const ClientSchema = z.object({
  company: z.string().min(2, "Company is required"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  // Required — becomes the client's portal login.
  email: z.string().email("A valid email is required (used for the client login)"),
  sector: z.string().optional(),
  sectorOther: z.string().optional(),
  ntn: z.string().optional(),
  stn: z.string().optional(),
});

// Client registration by the Liaison Officer (SSOT §5, Module 03).
export async function createClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterClient(actor.designation))
    return { error: "Only the Liaison Officer can register clients." };

  const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
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
  if (!section)
    return { error: "No section configured for your facility." };

  // "Other" sector → use the typed value.
  const sector =
    d.sector === "Other" ? d.sectorOther?.trim() || null : d.sector || null;

  const clientNo = await nextNumber({ key: "CLIENT", prefix: "CLI", pad: 5 });
  const tempPassword = randomBytes(6).toString("base64url"); // ~8 chars, one-time
  const passwordHash = await hash(tempPassword);

  const client = await prisma.client.create({
    data: {
      clientNo,
      company: d.company,
      addressLine1: d.addressLine1 || null,
      addressLine2: d.addressLine2 || null,
      addressLine3: d.addressLine3 || null,
      city: d.city || null,
      province: d.province || null,
      country: d.country || null,
      contactPerson: d.contactPerson || null,
      contactNumber: d.contactNumber || null,
      email,
      sector,
      ntn: d.ntn || null,
      stn: d.stn || null,
      facilityId: actor.facilityId,
      createdById: actor.id,
      // Portal login for the client (CLIENT designation, sees only its own data).
      portalUsers: {
        create: {
          email,
          passwordHash,
          status: "ACTIVE",
          designation: "CLIENT",
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
    entityType: "Client",
    entityId: client.id,
    after: { clientNo, company: d.company, portalLogin: email },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/clients");
  return { ok: true, loginEmail: email, tempPassword };
}
