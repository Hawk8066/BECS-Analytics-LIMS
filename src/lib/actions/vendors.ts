"use server";

import { z } from "zod";
import { hash } from "argon2";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterVendor } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = {
  error?: string;
  ok?: boolean;
  loginEmail?: string;
  tempPassword?: string;
};

const VendorSchema = z.object({
  company: z.string().min(2, "Company is required"),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  ntn: z.string().optional(),
  stn: z.string().optional(),
  // Required — becomes the vendor's portal login.
  email: z.string().email("A valid email is required (used for the vendor login)"),
  employees: z.string().optional(),
  accountNumber: z.string().optional(),
});

// Vendor registration by the Accountant (SSOT §5, Module 02).
export async function createVendor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterVendor(actor.designation))
    return { error: "Only the Accountant can register vendors." };

  const parsed = VendorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const fields = formData.getAll("fields").map(String).filter(Boolean);

  const email = d.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } }))
    return { error: "That email is already registered to a user." };

  const section = await prisma.section.findFirst({
    where: { facilityId: actor.facilityId },
  });
  if (!section) return { error: "No section configured for your facility." };

  const vendorNo = await nextNumber({ key: "VENDOR", prefix: "VEN", pad: 5 });
  const tempPassword = randomBytes(6).toString("base64url");
  const passwordHash = await hash(tempPassword);

  const vendor = await prisma.vendor.create({
    data: {
      vendorNo,
      company: d.company,
      address: d.address || null,
      contactNumber: d.contactNumber || null,
      ntn: d.ntn || null,
      stn: d.stn || null,
      email,
      employees: d.employees ? parseInt(d.employees, 10) || null : null,
      fields,
      accountNumber: d.accountNumber || null,
      createdById: actor.id,
      // Portal login for the vendor (VENDOR designation, sees only its own data).
      portalUsers: {
        create: {
          email,
          passwordHash,
          status: "ACTIVE",
          designation: "VENDOR",
          facilityId: actor.facilityId,
          sectionId: section.id,
        },
      },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Vendor",
    entityId: vendor.id,
    after: { vendorNo, company: d.company, portalLogin: email },
  });

  revalidatePath("/app/vendors");
  return { ok: true, loginEmail: email, tempPassword };
}
