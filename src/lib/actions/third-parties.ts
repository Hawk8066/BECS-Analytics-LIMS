"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterClient } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = {
  error?: string;
  ok?: boolean;
  // Returned on create so the inline booking quick-add can select the new entry.
  id?: string;
  label?: string;
};

const ThirdPartySchema = z.object({
  company: z.string().min(2, "Name is required"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().optional(),
  ntn: z.string().optional(),
  stn: z.string().optional(),
  referenceClientId: z.string().optional(),
});

function dataFrom(d: z.infer<typeof ThirdPartySchema>) {
  return {
    company: d.company,
    addressLine1: d.addressLine1 || null,
    addressLine2: d.addressLine2 || null,
    addressLine3: d.addressLine3 || null,
    city: d.city || null,
    province: d.province || null,
    country: d.country || null,
    contactPerson: d.contactPerson || null,
    contactNumber: d.contactNumber || null,
    email: d.email || null,
    ntn: d.ntn || null,
    stn: d.stn || null,
    referenceClientId: d.referenceClientId || null,
  };
}

// A third party the report may be issued in the name of. Managed by whoever
// registers clients (Liaison Officer / COO / admin).
export async function createThirdParty(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterClient(actor.designation))
    return { error: "Not permitted to add third parties." };

  const parsed = ThirdPartySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const code = await nextNumber({ key: "THIRD_PARTY", prefix: "TP", pad: 5 });
  const tp = await prisma.thirdParty.create({
    data: {
      code,
      ...dataFrom(parsed.data),
      facilityId: actor.facilityId,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "ThirdParty",
    entityId: tp.id,
    after: { code, company: tp.company },
    facilityId: actor.facilityId,
  });
  revalidatePath("/app/third-parties");
  return { ok: true, id: tp.id, label: tp.company };
}

export async function updateThirdParty(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterClient(actor.designation))
    return { error: "Not permitted to edit third parties." };

  const id = String(formData.get("thirdPartyId") || "");
  const tp = await prisma.thirdParty.findUnique({ where: { id } });
  if (!tp) return { error: "Third party not found." };

  const parsed = ThirdPartySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.thirdParty.update({ where: { id }, data: dataFrom(parsed.data) });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "ThirdParty",
    entityId: id,
    after: { company: parsed.data.company },
    facilityId: tp.facilityId,
  });
  revalidatePath(`/app/third-parties/${id}`);
  revalidatePath("/app/third-parties");
  return { ok: true };
}
