import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { getFeedSnapshot } from "@/lib/feed/query";
import { pruneFeed } from "@/lib/feed/prune";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The bell + news reel poll this instead of refreshing the whole server tree.
 *
 * Why a route handler rather than `revalidatePath("/app","layout")`: revalidate
 * does not push — it only affects the actor's own next request, so nobody else
 * would ever learn of an event — and it would re-run every page's queries on the
 * whole /app subtree. A layout-wide `router.refresh()` has the same cost problem.
 *
 * A weak ETag over the snapshot watermark lets an unchanged poll answer 304, so
 * the common case costs no payload and triggers no client re-render.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (user.status !== "ACTIVE") return Response.json(EMPTY);

  const snapshot = await getFeedSnapshot(user);
  const etag = `W/"${Buffer.from(snapshot.watermark).toString("base64url")}"`;

  if (req.headers.get("if-none-match") === etag) {
    void pruneFeed();
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  void pruneFeed(); // fire-and-forget, self-throttled to hourly
  return Response.json(snapshot, {
    headers: { ETag: etag, "Cache-Control": "no-store" },
  });
}

const EMPTY = { unread: 0, inbox: [], tasks: [], reel: [], watermark: "" };
