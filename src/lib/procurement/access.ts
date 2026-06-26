import type { Designation } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

// Procurement roles operate facility-wide (they handle all PRs for the facility,
// not just their own section). Senior roles (COO/OM) see everything (SSOT §7).
const FACILITY_WIDE: Designation[] = [
  "PURCHASE_OFFICER",
  "STORE_INCHARGE",
  "ACCOUNTANT",
];

export function procurementListWhere(user: SessionUser): {
  facilityId?: string;
  sectionId?: string;
} {
  if (user.canReadCrossSection) return {};
  if (FACILITY_WIDE.includes(user.designation))
    return { facilityId: user.facilityId };
  return { facilityId: user.facilityId, sectionId: user.sectionId };
}

export function canAccessPR(
  user: SessionUser,
  pr: { facilityId: string; sectionId: string },
): boolean {
  if (user.canReadCrossSection) return true;
  if (pr.facilityId !== user.facilityId) return false;
  if (FACILITY_WIDE.includes(user.designation)) return true;
  return pr.sectionId === user.sectionId;
}
