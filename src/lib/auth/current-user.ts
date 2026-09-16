import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { ensureCapabilitiesLoaded } from "@/lib/auth/capability-store";
import { grantsCrossSectionRead } from "@/lib/auth/session";

/**
 * The live account state behind the session token.
 *
 * The session is a JWT whose claims are written once, at sign-in, and never
 * refreshed (see `src/auth.config.ts` — the jwt callback only fills claims
 * `if (user)`). With no `maxAge` configured that token is valid for 30 days, so
 * without this re-read, deactivating someone would not take effect until their
 * cookie expired: every `status !== "ACTIVE"` check in the app reads the token,
 * not the database. The same staleness applied to a changed designation, which
 * is why a role change previously required signing out and back in.
 *
 * Wrapped in React `cache()` so the whole render tree — layout, page and every
 * server action in that request — shares one lookup. It is a single primary-key
 * read, and the page it serves already runs many more.
 *
 * Returns null when the account has been deleted, which logs the holder of an
 * orphaned token out rather than trusting its claims.
 */
const liveAccount = cache(async (userId: string) => {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        designation: true,
        facilityId: true,
        sectionId: true,
      },
    });
  } catch (e) {
    // A database blip must not sign the whole company out: fall back to the
    // token's claims, which is the behaviour this function replaced.
    console.error("[auth] live account lookup failed; using token claims", e);
    return undefined;
  }
});

// Resolves the authenticated principal in Server Components / Server Actions.
// Also warms the Tier-1 capability matrix: every page and action calls this
// before any synchronous `canX(...)` check runs, so the admin-configured matrix
// is in memory by the time those predicates are evaluated.
export async function getSessionUser(): Promise<SessionUser | null> {
  const [session] = await Promise.all([auth(), ensureCapabilitiesLoaded()]);
  const u = session?.user;
  if (!u?.id) return null;

  const live = await liveAccount(u.id);
  if (live === null) return null; // account deleted: the token is orphaned

  // `undefined` means the lookup itself failed — keep the token's claims.
  const designation = live?.designation ?? u.designation;

  return {
    id: u.id,
    email: u.email ?? "",
    designation,
    status: live?.status ?? u.status,
    facilityId: live?.facilityId ?? u.facilityId,
    sectionId: live?.sectionId ?? u.sectionId,
    clientId: u.clientId ?? null,
    vendorId: u.vendorId ?? null,
    outsourceLabId: u.outsourceLabId ?? null,
    roleKeys: u.roleKeys ?? [],
    // Recomputed from the live designation, so a demotion takes effect at once
    // rather than leaving cross-section read on a stale token.
    canReadCrossSection: grantsCrossSectionRead(designation),
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * The actor for anything that changes lab data.
 *
 * `requireUser` deliberately allows PENDING_PROFILE / PENDING_APPROVAL through,
 * because onboarding actions need it. Everything else must refuse a non-ACTIVE
 * account: page-level redirects are cosmetic against a direct POST to a server
 * action, so this is the gate that actually holds.
 */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.status !== "ACTIVE")
    throw new Error("This account is not active and cannot make changes.");
  return user;
}
