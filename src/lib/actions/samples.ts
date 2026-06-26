"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canRegisterSample } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

export type FormState = { error?: string };

const SampleSchema = z.object({
  clientId: z.string().min(1, "Select a client"),
  sampleType: z.string().min(1, "Sample type is required"),
  clientSampleRef: z.string().optional(),
  priority: z.string().optional(),
  instructions: z.string().optional(),
  thirdPartyName: z.string().optional(),
});

// Sample registration: LO (Lahore) / Lab Manager (RYK). Assigns a coded Lab ID
// (SSOT §11) and begins blinding (SSOT §8).
export async function registerSample(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canRegisterSample(actor.designation))
    return { error: "Not permitted to register samples." };

  const parsed = SampleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const parameterIds = formData
    .getAll("parameterIds")
    .map(String)
    .filter(Boolean);
  if (parameterIds.length === 0)
    return { error: "Select at least one parameter." };

  const facility = await prisma.facility.findUnique({
    where: { id: actor.facilityId },
  });
  if (!facility) return { error: "Facility not found." };

  const year = new Date().getFullYear();
  const labId = await nextNumber({
    key: `SAMPLE:${facility.code}:${year}`,
    prefix: `${facility.code}-S`,
    year,
    pad: 6,
  });

  const sample = await prisma.sample.create({
    data: {
      labId,
      clientId: d.clientId,
      sampleType: d.sampleType,
      clientSampleRef: d.clientSampleRef || null,
      priority: d.priority || null,
      instructions: d.instructions || null,
      thirdPartyName: d.thirdPartyName || null,
      facilityId: actor.facilityId,
      sectionId: actor.sectionId,
      registeredById: actor.id,
      parameters: { create: parameterIds.map((parameterId) => ({ parameterId })) },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Sample",
    entityId: sample.id,
    after: { labId, parameters: parameterIds.length },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/samples");
  redirect(`/app/samples/${sample.id}`);
}
