import type { SessionUser } from "@/lib/auth/session";
import { canSeeClientIdentity } from "./blinding";

// Sample/report visibility (SSOT §7 + §8). Senior roles (COO/OM) see all
// sections. The Liaison Officer is the client-facing role and sees their whole
// facility (all sections) — they register clients and receive decoded reports.
// Everyone else is restricted to their own section.

export function sampleListWhere(user: SessionUser): {
  facilityId?: string;
  sectionId?: string;
} {
  if (user.canReadCrossSection) return {};
  if (canSeeClientIdentity(user.designation))
    return { facilityId: user.facilityId };
  return { facilityId: user.facilityId, sectionId: user.sectionId };
}

export function canAccessSample(
  user: SessionUser,
  sample: { facilityId: string; sectionId: string },
): boolean {
  if (user.canReadCrossSection) return true;
  if (sample.facilityId !== user.facilityId) return false;
  if (canSeeClientIdentity(user.designation)) return true; // LO: facility-level
  return sample.sectionId === user.sectionId;
}
