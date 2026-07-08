import type { Designation, UserStatus } from "@prisma/client";

// The authenticated principal carried in the session (SSOT §5–§7).
export interface SessionUser {
  id: string;
  email: string;
  designation: Designation;
  status: UserStatus;
  facilityId: string;
  sectionId: string;
  clientId: string | null;
  roleKeys: string[];
  // Senior roles (COO, OM) get cross-section/facility read (SSOT §7).
  canReadCrossSection: boolean;
}

// Designations that may read across sections/facilities by default.
// ADMIN is the application super-admin and sees every facility/section.
const CROSS_SECTION_DESIGNATIONS: Designation[] = [
  "ADMIN",
  "COO",
  "OPERATIONS_MANAGER",
];

export function grantsCrossSectionRead(designation: Designation): boolean {
  return CROSS_SECTION_DESIGNATIONS.includes(designation);
}
