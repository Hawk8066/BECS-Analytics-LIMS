import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { effectiveDesignations } from "@/lib/auth/capability-store";
import { TEMPLATES, type ParamsOf, type TemplateKey } from "@/lib/feed/templates";

/**
 * Emit one activity event: a broadcast `FeedEvent` for the news reel, plus a
 * targeted `Notification` per recipient for the bell's Inbox.
 *
 * Call it immediately after the action's `writeAudit(...)` and BEFORE any
 * `revalidatePath` — and critically **before any `redirect()`**, which throws, so
 * nothing after it would run.
 *
 * Design guarantees:
 *  - `audience` is NOT a parameter — it comes from the template, so a caller can
 *    neither widen nor mistype it.
 *  - `params` is typed by `template`; naming the template tells you the params.
 *  - `to` is forgiving: nulls are dropped, ids de-duplicated, the actor removed
 *    (nobody wants "you assigned this to yourself"), and inactive users filtered.
 *  - It NEVER throws. A failed notification must never fail an approval.
 *  - It runs outside the caller's transaction, mirroring `writeAudit`.
 *
 * Standing work ("3 PRs await you") is deliberately NOT emitted here — that is
 * derived live in `tasks.ts`, so it self-clears and can never go stale.
 */

/** Role fan-out is capped so a mis-set capability matrix cannot amplify writes. */
const FAN_OUT_CAP = 25;

export interface PublishInput<K extends TemplateKey> {
  template: K;
  params: ParamsOf<K>;
  /**
   * Stamps the actor and supplies the default facility/section scope. Only the
   * three fields are needed, so system-driven paths (e.g. the sample
   * auto-advance) can pass a minimal actor rather than a full session.
   */
  actor: Pick<SessionUser, "id" | "facilityId" | "sectionId">;
  facilityId?: string;
  sectionId?: string;
  /** Explicit personal recipients — people with a direct stake in this event. */
  to?: (string | null | undefined)[];
  /** Collapses repeats for the same subject: "<template>:<subjectId>". */
  dedupeKey?: string;
  /** Personal-only notice: send the Inbox rows but keep it out of the reel. */
  reelSilent?: boolean;
}

export async function publish<K extends TemplateKey>(
  input: PublishInput<K>,
): Promise<void> {
  try {
    const def = TEMPLATES[input.template];
    const facilityId = input.facilityId ?? input.actor.facilityId;
    const sectionId = input.sectionId ?? input.actor.sectionId;
    const params = input.params as Prisma.InputJsonValue;

    // --- recipients ---------------------------------------------------------
    const direct = [...new Set((input.to ?? []).filter((id): id is string => !!id))]
      .filter((id) => id !== input.actor.id);

    let recipients = direct;
    if ("fanOut" in def && def.fanOut) {
      const designations = [...effectiveDesignations(def.audience)];
      if (designations.length > 0) {
        const holders = await prisma.user.findMany({
          where: {
            designation: { in: designations },
            status: "ACTIVE",
            facilityId,
            id: { notIn: [input.actor.id, ...direct] },
          },
          select: { id: true },
          take: FAN_OUT_CAP,
        });
        recipients = [...direct, ...holders.map((h) => h.id)];
      }
    }

    // Only active accounts receive Inbox rows.
    const active =
      recipients.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: recipients }, status: "ACTIVE" },
            select: { id: true },
          })
        : [];

    const writes: Prisma.PrismaPromise<unknown>[] = [];

    if (!input.reelSilent) {
      writes.push(
        prisma.feedEvent.create({
          data: {
            template: input.template,
            params,
            audienceKey: def.audience,
            facilityId,
            sectionId,
            actorId: input.actor.id,
          },
        }),
      );
    }

    if (active.length > 0) {
      writes.push(
        prisma.notification.createMany({
          data: active.map((u) => ({
            userId: u.id,
            kind: def.kind,
            template: input.template,
            params,
            actorId: input.actor.id,
            dedupeKey: input.dedupeKey ?? null,
          })),
          // Paired with @@unique([userId, dedupeKey]) => idempotent re-emits.
          skipDuplicates: true,
        }),
      );
    }

    if (writes.length > 0) await prisma.$transaction(writes);
  } catch (e) {
    // Swallow: the feed is never allowed to break the business action.
    console.error("[feed] publish failed", e);
  }
}
