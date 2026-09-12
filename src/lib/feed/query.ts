import "server-only";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import type { SessionUser } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/capability-store";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { renderFeedRow, type RenderedItem } from "@/lib/feed/render";
import { getTasks, type TaskItem } from "@/lib/feed/tasks";

/** One payload drives the bell (Tasks + Inbox) and the news reel. */
export interface FeedSnapshot {
  unread: number;
  inbox: RenderedItem[];
  tasks: TaskItem[];
  reel: RenderedItem[];
  /** Cheap change-detector for ETag/304 on the polling endpoint. */
  watermark: string;
}

const REEL_TAKE = 30;
const INBOX_TAKE = 20;

const actorSelect = {
  select: { email: true, profile: { select: { fullName: true } } },
} as const;

/**
 * The capability keys this viewer holds — computed in memory from the cached
 * matrix, so audience resolution costs no query. Storing the *key* on FeedEvent
 * (rather than a designation list) is what lets audiences re-resolve live when
 * the matrix is edited in Admin › Roles.
 */
function heldAudiences(user: SessionUser): string[] {
  return CAPABILITIES.filter((c) => hasCapability(c.key, user.designation)).map(
    (c) => c.key,
  );
}

export async function getFeedSnapshot(user: SessionUser): Promise<FeedSnapshot> {
  const audiences = heldAudiences(user);

  // Scope: reuse readScope verbatim — facility + section for normal staff, and
  // unscoped for cross-section readers (ADMIN/COO/OM). Deliberate consequence:
  // a MANAGEMENT-section user does not see lab-section events. To widen the reel
  // to facility-only later, drop `sectionId` from this one spread.
  const scope = readScope(user);

  const [reelRows, inboxRows, unread, tasks] = await Promise.all([
    audiences.length === 0
      ? Promise.resolve([])
      : prisma.feedEvent.findMany({
          where: { ...scope, audienceKey: { in: audiences } },
          orderBy: { createdAt: "desc" },
          take: REEL_TAKE,
          include: { actor: actorSelect },
        }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: INBOX_TAKE,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    getTasks(user),
  ]);

  const reel = reelRows
    .map((r) => renderFeedRow(r, user.designation))
    .filter((x): x is RenderedItem => x !== null);
  const inbox = inboxRows
    .map((r) => renderFeedRow({ ...r, actor: null }, user.designation))
    .filter((x): x is RenderedItem => x !== null);

  const newest = (a?: RenderedItem, b?: RenderedItem) =>
    [a?.at ?? "", b?.at ?? ""].sort().at(-1) ?? "";

  return {
    unread,
    inbox,
    tasks,
    reel,
    watermark: `${newest(reel[0], inbox[0])}|${unread}|${tasks.length}`,
  };
}
