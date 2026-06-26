"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/audit/audit-log";

// E-sign the Impartiality & Confidentiality undertaking (once per user).
export async function signUndertaking(): Promise<void> {
  const actor = await requireUser();

  if (await prisma.impartialityUndertaking.findUnique({ where: { userId: actor.id } }))
    return;

  const u = await prisma.impartialityUndertaking.create({
    data: { userId: actor.id },
  });
  await prisma.signature.create({
    data: {
      signerId: actor.id,
      subjectType: "ImpartialityUndertaking",
      subjectId: u.id,
      meaning: "undertaking",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "SIGN",
    entityType: "ImpartialityUndertaking",
    entityId: u.id,
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/undertaking");
}
