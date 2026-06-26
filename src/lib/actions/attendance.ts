"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/audit/audit-log";

// Server-authoritative "today" at midnight (SSOT BR-14).
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// E-signed check-in (BR-20). Idempotent: re-clicking does nothing once checked in.
export async function checkIn(): Promise<void> {
  const actor = await requireUser();
  const date = startOfToday();

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: actor.id, date } },
  });
  if (existing?.checkIn) return;

  const att = await prisma.attendance.upsert({
    where: { userId_date: { userId: actor.id, date } },
    update: { checkIn: new Date(), status: "PRESENT" },
    create: {
      userId: actor.id,
      date,
      checkIn: new Date(),
      status: "PRESENT",
      facilityId: actor.facilityId,
      sectionId: actor.sectionId,
    },
  });

  await prisma.signature.create({
    data: {
      signerId: actor.id,
      subjectType: "Attendance",
      subjectId: att.id,
      meaning: "checked-in",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "SIGN",
    entityType: "Attendance",
    entityId: att.id,
    after: { checkIn: true },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/attendance");
}

// E-signed check-out (BR-20). Requires a prior check-in the same day.
export async function checkOut(): Promise<void> {
  const actor = await requireUser();
  const date = startOfToday();

  const att = await prisma.attendance.findUnique({
    where: { userId_date: { userId: actor.id, date } },
  });
  if (!att || !att.checkIn || att.checkOut) return;

  await prisma.attendance.update({
    where: { id: att.id },
    data: { checkOut: new Date() },
  });
  await prisma.signature.create({
    data: {
      signerId: actor.id,
      subjectType: "Attendance",
      subjectId: att.id,
      meaning: "checked-out",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "SIGN",
    entityType: "Attendance",
    entityId: att.id,
    after: { checkOut: true },
    facilityId: actor.facilityId,
    sectionId: actor.sectionId,
  });

  revalidatePath("/app/attendance");
}
