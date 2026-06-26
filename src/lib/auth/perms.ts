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

/** Client registration: Liaison Officer (SSOT §5); COO as admin. */
export const canRegisterClient = (d: Designation) =>
  d === "LIAISON_OFFICER" || d === "COO";

/** Sample registration: LO at Lahore, Lab Manager at RYK (SSOT §5, D17); COO admin. */
export const canRegisterSample = (d: Designation) =>
  d === "LIAISON_OFFICER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Coordinator: assigns samples to analysts and verifies results (OM / Lab Manager / COO). */
export const canCoordinateTesting = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Only the COO approves results and releases the final report (SSOT §5, BR-1). */
export const canApproveSample = (d: Designation) => d === "COO";

/** Vendor registration by the Accountant (SSOT §5); COO admin. */
export const canRegisterVendor = (d: Designation) =>
  d === "ACCOUNTANT" || d === "COO";

/** PR verification: OM @ Lahore / Lab Manager @ RYK before COO approval (D18). */
export const canVerifyPR = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Only the COO approves Purchase Requests (SSOT §5, BR-1). */
export const canApprovePR = (d: Designation) => d === "COO";

/** Purchase Officer records quotations and generates POs (SSOT §5); COO admin. */
export const canRecordQuotation = (d: Designation) =>
  d === "PURCHASE_OFFICER" || d === "COO";
export const canGeneratePO = (d: Designation) =>
  d === "PURCHASE_OFFICER" || d === "COO";

/** Only the COO selects the winning quotation (SSOT §5). */
export const canSelectQuotation = (d: Designation) => d === "COO";
