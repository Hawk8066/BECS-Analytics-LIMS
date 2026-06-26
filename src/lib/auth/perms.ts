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

/** OM (and COO) create/edit functions; the COO approves them (SSOT §5). */
export const canManageFunctions = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "COO";
export const canApproveFunction = (d: Designation) => d === "COO";

/** Competence evaluators: OM, COO, and the RYK Lab Manager. */
export const canEvaluateCompetence = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "COO" || d === "LAB_MANAGER_RYK";

/** Only the COO grants/revokes authorizations (SSOT §5, §6). */
export const canGrantAuthorization = (d: Designation) => d === "COO";

/** Leave approvers: OM, COO, and the RYK Lab Manager (per hierarchy). */
export const canApproveLeave = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "COO" || d === "LAB_MANAGER_RYK";
