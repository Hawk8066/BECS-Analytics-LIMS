import { auth } from "@/auth";
import type { SessionUser } from "@/lib/auth/session";

// Resolves the authenticated principal in Server Components / Server Actions.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    designation: u.designation,
    status: u.status,
    facilityId: u.facilityId,
    sectionId: u.sectionId,
    roleKeys: u.roleKeys ?? [],
    canReadCrossSection: u.canReadCrossSection ?? false,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
