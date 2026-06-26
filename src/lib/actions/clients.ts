"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterClient } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = { error?: string };

const ClientSchema = z.object({
  company: z.string().min(2, "Company is required"),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  sector: z.string().optional(),
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

  const clientNo = await nextNumber({ key: "CLIENT", prefix: "CLI", pad: 5 });
  const client = await prisma.client.create({
    data: {
      clientNo,
      company: d.company,
      address: d.address || null,
      contactPerson: d.contactPerson || null,
      contactNumber: d.contactNumber || null,
      email: d.email || null,
      sector: d.sector || null,
      facilityId: actor.facilityId,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Client",
    entityId: client.id,
    after: { clientNo, company: d.company },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/clients");
  redirect("/app/clients");
}
