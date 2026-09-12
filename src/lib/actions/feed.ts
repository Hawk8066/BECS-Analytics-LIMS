"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";

// Read-state for the bell's Inbox. Always scoped to the caller's own rows —
// a notification belongs to exactly one recipient, so `userId` IS the guard.

export async function markNotificationRead(id: string): Promise<void> {
  const actor = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const actor = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
}
