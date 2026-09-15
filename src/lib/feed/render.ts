import type { Designation } from "@prisma/client";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { TEMPLATES, type FeedKind, type TemplateKey } from "@/lib/feed/templates";

/**
 * The single place a feed line becomes text.
 *
 * This is the blinding choke point: a template that carries client identity
 * exposes it only through `renderIdentified`, and only this function decides
 * which of the two to call — per *viewer*, at read time. Consequences:
 *   - reassigning `seeClientIdentity` in Admin › Roles re-resolves history;
 *   - stored rows never contain rendered text, so nothing is frozen at write time;
 *   - callers cannot bypass it, because `/api/feed` returns only what this emits.
 *
 * A row whose template no longer exists (renamed/removed) renders as null and is
 * dropped by the caller rather than throwing — old rows must never break the bell.
 */
export interface RenderedItem {
  id: string;
  kind: FeedKind;
  text: string;
  href: string;
  at: string;
  actor: string | null;
  readAt?: string | null;
}

export function renderFeedRow(
  row: {
    id: string;
    template: string;
    params: unknown;
    createdAt: Date;
    readAt?: Date | null;
    actor?: { email: string; profile?: { fullName: string } | null } | null;
  },
  viewer: Designation,
): RenderedItem | null {
  const def = TEMPLATES[row.template as TemplateKey];
  if (!def) return null;

  const params = (row.params ?? {}) as never;
  try {
    const identified =
      "renderIdentified" in def && canSeeClientIdentity(viewer)
        ? (def.renderIdentified as (p: never) => string)
        : null;
    const text = (identified ?? (def.render as (p: never) => string))(params);
    const href = (def.href as (p: never) => string)(params);

    return {
      id: row.id,
      kind: def.kind,
      text,
      href,
      at: row.createdAt.toISOString(),
      actor: row.actor?.profile?.fullName ?? row.actor?.email ?? null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
    };
  } catch {
    // Malformed params (e.g. a template's shape changed) must not break the feed.
    return null;
  }
}
