import type { Designation } from "@prisma/client";

// Designation-based capability checks (Tier 1, SSOT §5). These complement the
// per-Function authorization gating (Tier 2) in authorization.ts.

// Application super-admin. ADMIN is intentionally above the SSOT role matrix:
// it bypasses every Tier-1 gate below so it can view/edit/delete anything.
// Every ADMIN action is still recorded in the immutable audit log (BR-5).
export const isAdmin = (d: Designation) => d === "ADMIN";

export const isCOO = (d: Designation) => d === "COO";
export const isOM = (d: Designation) => d === "OPERATIONS_MANAGER";

/**
 * External portal logins. Clients and vendors are Users so they can sign in to
 * their own portal, but they are not lab personnel — they must stay out of
 * staff rosters (personnel, payroll, competence, and the like).
 */
export const PORTAL_DESIGNATIONS: readonly Designation[] = [
  "CLIENT",
  "VENDOR",
  "OUTSOURCE_LAB",
];
export const isPortalUser = (d: Designation) =>
  d === "CLIENT" || d === "VENDOR" || d === "OUTSOURCE_LAB";

/** OM (and COO) manage personnel profile shells and functions (SSOT §5). */
export const canManagePersonnel = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "COO";

/** Only the COO approves profiles / authorizations (SSOT §5). */
export const canApproveProfile = (d: Designation) => isAdmin(d) || d === "COO";

/** OM (and COO) create/edit functions; the COO approves them (SSOT §5). */
export const canManageFunctions = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "COO";
export const canApproveFunction = (d: Designation) => isAdmin(d) || d === "COO";

/** Competence evaluators: OM, COO, and the RYK Lab Manager. */
export const canEvaluateCompetence = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "COO" || d === "LAB_MANAGER_RYK";

/** Only the COO grants/revokes authorizations (SSOT §5, §6). */
export const canGrantAuthorization = (d: Designation) => isAdmin(d) || d === "COO";

/** Leave approvers: OM, COO, and the RYK Lab Manager (per hierarchy). */
export const canApproveLeave = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "COO" || d === "LAB_MANAGER_RYK";

/** Client registration: Liaison Officer (SSOT §5); COO as admin. */
export const canRegisterClient = (d: Designation) =>
  isAdmin(d) || d === "LIAISON_OFFICER" || d === "COO";

/** Sample registration: LO at Lahore, Lab Manager at RYK (SSOT §5, D17); COO admin. */
export const canRegisterSample = (d: Designation) =>
  isAdmin(d) || d === "LIAISON_OFFICER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Coordinator: assigns samples to analysts and verifies results (OM / Lab Manager / COO). */
export const canCoordinateTesting = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Only the COO approves results and releases the final report (SSOT §5, BR-1). */
export const canApproveSample = (d: Designation) => isAdmin(d) || d === "COO";

/** Vendor registration by the Accountant (SSOT §5); COO admin. */
export const canRegisterVendor = (d: Designation) =>
  isAdmin(d) || d === "ACCOUNTANT" || d === "COO";

/** Register outsourced (subcontractor) labs: testing coordinators + LO; COO admin. */
export const canRegisterOutsourceLab = (d: Designation) =>
  isAdmin(d) ||
  d === "OPERATIONS_MANAGER" ||
  d === "LAB_MANAGER_RYK" ||
  d === "LIAISON_OFFICER" ||
  d === "COO";

/** Set what an outsource lab charges us per test: lab coordinators + finance. */
export const canSetOutsourcePrice = (d: Designation) =>
  canRegisterOutsourceLab(d) || d === "ACCOUNTANT";

/** Record outsource-lab bills (payables): finance (Accountant / COO / admin). */
export const canManageOutsourceBilling = (d: Designation) =>
  isAdmin(d) || d === "ACCOUNTANT" || d === "COO";

/** PR verification: OM @ Lahore / Lab Manager @ RYK before COO approval (D18). */
export const canVerifyPR = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Only the COO approves Purchase Requests (SSOT §5, BR-1). */
export const canApprovePR = (d: Designation) => isAdmin(d) || d === "COO";

/** Purchase Officer records quotations and generates POs (SSOT §5); COO admin. */
export const canRecordQuotation = (d: Designation) =>
  isAdmin(d) || d === "PURCHASE_OFFICER" || d === "COO";
export const canGeneratePO = (d: Designation) =>
  isAdmin(d) || d === "PURCHASE_OFFICER" || d === "COO";

/** Only the COO selects the winning quotation (SSOT §5). */
export const canSelectQuotation = (d: Designation) => isAdmin(d) || d === "COO";

/** Purchase Officer marks goods received (SSOT §5); COO admin. */
export const canMarkReceived = (d: Designation) =>
  isAdmin(d) || d === "PURCHASE_OFFICER" || d === "COO";

/** Goods inspection: OM @ Lahore / Lab Manager @ RYK accept/reject (SSOT §5). */
export const canInspectGoods = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Store In-charge issues GRNs and approves issue requests (SSOT §5, BR-10/11). */
export const canManageStore = (d: Designation) =>
  isAdmin(d) || d === "STORE_INCHARGE" || d === "COO";

/** Equipment register, calibration & qualification records: OM / Lab Manager / COO. */
export const canManageEquipment = (d: Designation) =>
  isAdmin(d) || d === "OPERATIONS_MANAGER" || d === "LAB_MANAGER_RYK" || d === "COO";

/** Materials register (chemicals/CRM/glassware/lab supplies) + certificate intake. */
export const canManageMaterials = (d: Designation) =>
  isAdmin(d) ||
  d === "OPERATIONS_MANAGER" ||
  d === "LAB_MANAGER_RYK" ||
  d === "STORE_INCHARGE" ||
  d === "COO";

/** Client invoices: LO generates them (SSOT §5); Accountant/COO too. */
export const canIssueInvoice = (d: Designation) =>
  isAdmin(d) || d === "LIAISON_OFFICER" || d === "ACCOUNTANT" || d === "COO";

/** Incoming client payments recordable by Accountant or LO (D6); COO admin. */
export const canRecordPayment = (d: Designation) =>
  isAdmin(d) || d === "ACCOUNTANT" || d === "LIAISON_OFFICER" || d === "COO";

/** Finance ledger/reports visibility. */
export const canViewFinance = (d: Designation) =>
  isAdmin(d) || d === "ACCOUNTANT" || d === "COO" || d === "OPERATIONS_MANAGER";

/** Accountant sets salary structures and prepares payroll runs; COO approves. */
export const canManagePayroll = (d: Designation) =>
  isAdmin(d) || d === "ACCOUNTANT" || d === "COO";
export const canApprovePayroll = (d: Designation) => isAdmin(d) || d === "COO";

/** Access to the generic Admin panel (view/edit/delete any record). ADMIN only. */
export const canAdminister = (d: Designation) => isAdmin(d);

/** Propose/manage test parameters: OM, LO, RYK Lab Manager (COO too). */
export const canManageParameters = (d: Designation) =>
  isAdmin(d) ||
  d === "OPERATIONS_MANAGER" ||
  d === "LIAISON_OFFICER" ||
  d === "LAB_MANAGER_RYK" ||
  d === "COO";

/** Only the COO approves parameters (makes them available for samples). */
export const canApproveParameter = (d: Designation) => isAdmin(d) || d === "COO";

/** Manage conformity standards (acceptance limits) — same roles as parameters. */
export const canManageStandards = (d: Designation) =>
  isAdmin(d) ||
  d === "OPERATIONS_MANAGER" ||
  d === "LIAISON_OFFICER" ||
  d === "LAB_MANAGER_RYK" ||
  d === "COO";

/** Access the BTF Quality Control portal (anyone who books, runs, or reviews QC). */
export const canAccessProductionQc = (d: Designation) =>
  isAdmin(d) ||
  d === "COO" ||
  d === "OPERATIONS_MANAGER" ||
  d === "LAB_MANAGER_RYK" ||
  d === "ANALYST";

/** Book/assign production-QC lots + set specs: RYK Lab Manager (OM/COO too). */
export const canManageProductionQc = (d: Designation) =>
  isAdmin(d) ||
  d === "LAB_MANAGER_RYK" ||
  d === "OPERATIONS_MANAGER" ||
  d === "COO";

/** Submit a QC result: the assigned Analyst (managers too; assignment enforced in the action). */
export const canSubmitResult = (d: Designation) =>
  isAdmin(d) ||
  d === "ANALYST" ||
  d === "LAB_MANAGER_RYK" ||
  d === "OPERATIONS_MANAGER" ||
  d === "COO";

/** Review/approve production-QC results: RYK Lab Manager or COO. */
export const canApproveLot = (d: Designation) =>
  isAdmin(d) || d === "LAB_MANAGER_RYK" || d === "COO";

/** Create/manage client quotations for testing (sales/front-office roles). */
export const canManageQuotations = (d: Designation) =>
  isAdmin(d) ||
  d === "LIAISON_OFFICER" ||
  d === "ACCOUNTANT" ||
  d === "SALES_MARKETING_OFFICER" ||
  d === "COO";
