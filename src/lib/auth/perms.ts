import type { Designation } from "@prisma/client";

// Designation-based capability checks (Tier 1, SSOT §5). These complement the
// per-Function authorization gating (Tier 2) in authorization.ts.

export const isCOO = (d: Designation) => d === "COO";
export const isOM = (d: Designation) => d === "OPERATIONS_MANAGER";

/** OM (and COO) manage personnel profile shells and functions (SSOT §5). */
export const canManagePersonnel = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "COO";

/** Only the COO approves profiles / authorizations (SSOT §5). */
export const canApproveProfile = (d: Designation) => d === "COO";
