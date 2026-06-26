"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterVendor } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = { error?: string };

const VendorSchema = z.object({
  company: z.string().min(2, "Company is required"),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  ntn: z.string().optional(),
  stn: z.string().optional(),
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

  const vendorNo = await nextNumber({ key: "VENDOR", prefix: "VEN", pad: 5 });
  const vendor = await prisma.vendor.create({
    data: {
      vendorNo,
      company: d.company,
      address: d.address || null,
      contactNumber: d.contactNumber || null,
      ntn: d.ntn || null,
      stn: d.stn || null,
      employees: d.employees ? parseInt(d.employees, 10) || null : null,
      fields,
      accountNumber: d.accountNumber || null,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Vendor",
    entityId: vendor.id,
    after: { vendorNo, company: d.company },
  });

  revalidatePath("/app/vendors");
  redirect("/app/vendors");
}
