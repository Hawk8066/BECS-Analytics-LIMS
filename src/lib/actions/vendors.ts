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

const VendorUpdateSchema = z.object({
  company: z.string().min(2, "Company is required"),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  ntn: z.string().optional(),
  stn: z.string().optional(),
  employees: z.string().optional(),
  accountNumber: z.string().optional(),
});

// Edit a vendor's business details (not the login — that's managed separately).
export async function updateVendor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterVendor(actor.designation))
    return { error: "Not permitted to edit vendors." };

  const vendorId = String(formData.get("vendorId") || "");
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { error: "Vendor not found." };

  const parsed = VendorUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const fields = formData.getAll("fields").map(String).filter(Boolean);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      company: d.company,
      address: d.address || null,
      contactNumber: d.contactNumber || null,
      ntn: d.ntn || null,
      stn: d.stn || null,
      employees: d.employees ? parseInt(d.employees, 10) || null : null,
      accountNumber: d.accountNumber || null,
      fields,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Vendor",
    entityId: vendorId,
    after: { company: d.company, fields },
  });
  revalidatePath(`/app/vendors/${vendorId}`);
  revalidatePath("/app/vendors");
  return { ok: true };
}

// Create a portal login for a vendor that doesn't have one. The email becomes the
// vendor's login and stored contact email; a one-time password is returned.
export async function createVendorPortal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterVendor(actor.designation))
    return { error: "Not permitted to manage vendor logins." };

  const vendorId = String(formData.get("vendorId") || "");
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { portalUsers: { where: { designation: "VENDOR" } } },
  });
  if (!vendor) return { error: "Vendor not found." };
  if (vendor.portalUsers.length > 0)
    return { error: "This vendor already has a portal login." };

  const email = String(formData.get("email") || vendor.email || "")
    .trim()
    .toLowerCase();
  if (!z.string().email().safeParse(email).success)
    return { error: "A valid email is required for the login." };
  if (await prisma.user.findUnique({ where: { email } }))
    return { error: "That email is already registered to a user." };

  const section = await prisma.section.findFirst({
    where: { facilityId: actor.facilityId },
  });
  if (!section) return { error: "No section configured for your facility." };

  const tempPassword = randomBytes(6).toString("base64url");
  const passwordHash = await hash(tempPassword);
  await prisma.$transaction([
    prisma.user.create({
      data: {
        email,
        passwordHash,
        status: "ACTIVE",
        designation: "VENDOR",
        facilityId: actor.facilityId,
        sectionId: section.id,
        vendorId,
      },
    }),
    prisma.vendor.update({ where: { id: vendorId }, data: { email } }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "User",
    entityId: email,
    after: { vendorPortalLogin: email, vendorId },
  });
  revalidatePath(`/app/vendors/${vendorId}`);
  return { ok: true, loginEmail: email, tempPassword };
}

// Remove a vendor's portal login. Audit rows keep the event but drop the actor
// link (nullable FK) so the user row can be deleted.
export async function deleteVendorPortal(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canRegisterVendor(actor.designation))
    throw new Error("Not permitted to manage vendor logins.");

  const vendorId = String(formData.get("vendorId") || "");
  const users = await prisma.user.findMany({
    where: { vendorId, designation: "VENDOR" },
    select: { id: true, email: true },
  });
  if (users.length === 0) throw new Error("No portal login to remove.");
  const ids = users.map((u) => u.id);

  await prisma.$transaction([
    prisma.auditLog.updateMany({
      where: { actorId: { in: ids } },
      data: { actorId: null },
    }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "User",
    entityId: ids.join(","),
    after: { vendorPortalRemoved: users.map((u) => u.email), vendorId },
  });
  revalidatePath(`/app/vendors/${vendorId}`);
}
