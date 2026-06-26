import type { SessionUser } from "@/lib/auth/session";

// Section + facility scoping (SSOT §7, ADR-0003).
//
// Every scoped query must be filtered to the actor's facility/section unless the
// actor holds an explicit cross-section read capability (COO, OM). This helper
// produces the `where` fragment; Postgres Row-Level Security is the defense-in-depth
// backstop (added via migration). NEVER run unscoped reads from app code.

export interface ScopeFilter {
  facilityId?: string;
  sectionId?: string;
}

/** Read scope: senior roles see everything; everyone else only their section. */
export function readScope(user: SessionUser): ScopeFilter {
  if (user.canReadCrossSection) return {};
  return { facilityId: user.facilityId, sectionId: user.sectionId };
}

/** Write scope: writes are always stamped with the actor's facility/section. */
export function writeScope(user: SessionUser): Required<ScopeFilter> {
  return { facilityId: user.facilityId, sectionId: user.sectionId };
}
