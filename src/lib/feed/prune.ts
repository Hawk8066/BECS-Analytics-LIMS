import "server-only";
import { prisma } from "@/lib/db";

/**
 * Retention for the feed tables, run opportunistically off the polling endpoint
 * (there is no cron or worker in this app) and self-throttled to once an hour
 * per process.
 *
 * Deleting here is safe precisely because these tables are NOT the record of
 * truth — `AuditLog` is, and it is append-only and never pruned (BR-5). Keeping
 * the two separate is what makes this retention policy possible at all.
 */
const HOUR_MS = 60 * 60 * 1000;
const REEL_DAYS = 30;
const READ_DAYS = 90;
const UNREAD_DAYS = 180;

let lastPrunedAt = 0;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * HOUR_MS);

export async function pruneFeed(): Promise<void> {
  const now = Date.now();
  if (now - lastPrunedAt < HOUR_MS) return;
  lastPrunedAt = now; // set before awaiting so concurrent pollers don't pile up

  try {
    await prisma.$transaction([
      prisma.feedEvent.deleteMany({
        where: { createdAt: { lt: daysAgo(REEL_DAYS) } },
      }),
      prisma.notification.deleteMany({
        where: { readAt: { not: null }, createdAt: { lt: daysAgo(READ_DAYS) } },
      }),
      prisma.notification.deleteMany({
        where: { readAt: null, createdAt: { lt: daysAgo(UNREAD_DAYS) } },
      }),
    ]);
  } catch (e) {
    console.error("[feed] prune failed", e);
  }
}
