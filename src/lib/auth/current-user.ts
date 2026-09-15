import { auth } from "@/auth";
import type { SessionUser } from "@/lib/auth/session";
import { ensureCapabilitiesLoaded } from "@/lib/auth/capability-store";

// Resolves the authenticated principal in Server Components / Server Actions.
// Also warms the Tier-1 capability matrix: every page and action calls this
// before any synchronous `canX(...)` check runs, so the admin-configured matrix
// is in memory by the time those predicates are evaluated.
export async function getSessionUser(): Promise<SessionUser | null> {
  const [session] = await Promise.all([auth(), ensureCapabilitiesLoaded()]);
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    designation: u.designation,
    status: u.status,
    facilityId: u.facilityId,
    sectionId: u.sectionId,
    clientId: u.clientId ?? null,
    vendorId: u.vendorId ?? null,
    outsourceLabId: u.outsourceLabId ?? null,
    roleKeys: u.roleKeys ?? [],
    canReadCrossSection: u.canReadCrossSection ?? false,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
