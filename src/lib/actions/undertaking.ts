"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/audit/audit-log";

// E-sign the Impartiality & Confidentiality undertaking for the current year.
// Required on first sign-in and again at the start of each calendar year.
export async function signUndertaking(): Promise<void> {
  const actor = await requireUser();
  const year = new Date().getFullYear();

  // Idempotent: one signature per user per year.
  if (
    await prisma.impartialityUndertaking.findUnique({
      where: { userId_year: { userId: actor.id, year } },
    })
  )
    return;

  const u = await prisma.impartialityUndertaking.create({
    data: { userId: actor.id, year },
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
    after: { year },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/undertaking");
  revalidatePath("/app"); // clear the layout gate
}
