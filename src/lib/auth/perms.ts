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

/** Purchase Officer marks goods received (SSOT §5); COO admin. */
export const canMarkReceived = (d: Designation) =>
  d === "PURCHASE_OFFICER" || d === "COO";

/** Goods inspection: OM @ Lahore / Lab Manager @ RYK accept/reject (SSOT §5). */
export const canInspectGoods = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Store In-charge issues GRNs and approves issue requests (SSOT §5, BR-10/11). */
export const canManageStore = (d: Designation) =>
  d === "STORE_INCHARGE" || d === "COO";

/** Equipment register, calibration & qualification records: OM / Lab Manager / COO. */
export const canManageEquipment = (d: Designation) =>
  d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Materials register (chemicals/CRM/glassware/lab supplies) + certificate intake. */
export const canManageMaterials = (d: Designation) =>
  d === "OPERATIONS_MANAGER" ||
  d === "LAB_MANAGER_RYK" ||
  d === "STORE_INCHARGE" ||
  d === "COO";

/** Client invoices: LO generates them (SSOT §5); Accountant/COO too. */
export const canIssueInvoice = (d: Designation) =>
  d === "LIAISON_OFFICER" || d === "ACCOUNTANT" || d === "COO";

/** Incoming client payments recordable by Accountant or LO (D6); COO admin. */
export const canRecordPayment = (d: Designation) =>
  d === "ACCOUNTANT" || d === "LIAISON_OFFICER" || d === "COO";

/** Finance ledger/reports visibility. */
export const canViewFinance = (d: Designation) =>
  d === "ACCOUNTANT" || d === "COO" || d === "OPERATIONS_MANAGER";

/** Accountant sets salary structures and prepares payroll runs; COO approves. */
export const canManagePayroll = (d: Designation) =>
  d === "ACCOUNTANT" || d === "COO";
export const canApprovePayroll = (d: Designation) => d === "COO";
