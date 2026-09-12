import type { Designation } from "@prisma/client";
import { hasCapability } from "@/lib/auth/capability-store";

// Designation-based capability checks (Tier 1, SSOT §5). These complement the
// per-Function authorization gating (Tier 2) in authorization.ts.
//
// Each predicate below is a thin lookup into the capability matrix defined in
// capabilities.ts. The built-in defaults there reproduce the original hard-coded
// matrix exactly, and the super-admin can re-assign any capability to any
// designation from Admin › Roles — an unconfigured capability keeps its default.
// Signatures are unchanged, so every call site reads the same as before.

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

/**
 * The bench-analyst pool: the designations a sample parameter or a production-QC
 * lot may be assigned to. Lahore analysts and RYK on-site QC analysts do the same
 * work in different facilities, and every assignment query is additionally scoped
 * by facility/section — so always filter on this list rather than on "ANALYST",
 * otherwise RYK analysts silently disappear from assignment pickers.
 */
export const ANALYST_DESIGNATIONS: readonly Designation[] = [
  "ANALYST",
  "ANALYST_RYK",
];
export const isAnalyst = (d: Designation) =>
  d === "ANALYST" || d === "ANALYST_RYK";

/** Personnel profile shells and Functions. */
export const canManagePersonnel = (d: Designation) => hasCapability("managePersonnel", d);
/** Approve a profile — activates the account. */
export const canApproveProfile = (d: Designation) => hasCapability("approveProfile", d);
export const canManageFunctions = (d: Designation) => hasCapability("manageFunctions", d);
export const canApproveFunction = (d: Designation) => hasCapability("approveFunction", d);
/** Competence evaluators. */
export const canEvaluateCompetence = (d: Designation) => hasCapability("evaluateCompetence", d);
/** Grant / revoke Authorizations (SSOT §5, §6). */
export const canGrantAuthorization = (d: Designation) => hasCapability("grantAuthorization", d);
/** Leave approvers (per hierarchy). */
export const canApproveLeave = (d: Designation) => hasCapability("approveLeave", d);

/** Client registration (SSOT §5). */
export const canRegisterClient = (d: Designation) => hasCapability("registerClient", d);
/** Sample registration: LO at Lahore, Lab Manager at RYK (SSOT §5, D17). */
export const canRegisterSample = (d: Designation) => hasCapability("registerSample", d);
/** Coordinator: assigns samples to analysts and verifies results. */
export const canCoordinateTesting = (d: Designation) => hasCapability("coordinateTesting", d);
/** Approve results and release the final report (SSOT §5, BR-1). */
export const canApproveSample = (d: Designation) => hasCapability("approveSample", d);

/** Vendor registration (SSOT §5). */
export const canRegisterVendor = (d: Designation) => hasCapability("registerVendor", d);
/** Register outsourced (subcontractor) labs. */
export const canRegisterOutsourceLab = (d: Designation) => hasCapability("registerOutsourceLab", d);
/** Set what an outsource lab charges us per test. */
export const canSetOutsourcePrice = (d: Designation) => hasCapability("setOutsourcePrice", d);
/** Record vendor / outsource-lab bills and expenses (payables). */
export const canManageOutsourceBilling = (d: Designation) => hasCapability("manageOutsourceBilling", d);

/** PR verification: OM @ Lahore / Lab Manager @ RYK before COO approval (D18). */
export const canVerifyPR = (d: Designation) => hasCapability("verifyPR", d);
/** Approve Purchase Requests (SSOT §5, BR-1). */
export const canApprovePR = (d: Designation) => hasCapability("approvePR", d);
/** Purchase Officer records quotations and generates POs (SSOT §5). */
export const canRecordQuotation = (d: Designation) => hasCapability("recordQuotation", d);
export const canGeneratePO = (d: Designation) => hasCapability("generatePO", d);
/** Select the winning quotation (SSOT §5). */
export const canSelectQuotation = (d: Designation) => hasCapability("selectQuotation", d);
/** Mark goods received (SSOT §5). */
export const canMarkReceived = (d: Designation) => hasCapability("markReceived", d);
/** Goods inspection: accept/reject (SSOT §5). */
export const canInspectGoods = (d: Designation) => hasCapability("inspectGoods", d);

/** Store In-charge issues GRNs and approves issue requests (SSOT §5, BR-10/11). */
export const canManageStore = (d: Designation) => hasCapability("manageStore", d);
/** Equipment register, calibration, qualification & repair records. */
export const canManageEquipment = (d: Designation) => hasCapability("manageEquipment", d);
/**
 * Release equipment from the premises for off-site repair (BR-EQ-5). Defaults to
 * the Store In-charge (controls what physically leaves) plus the OM / RYK Lab
 * Manager running the repair.
 */
export const canIssueGatePass = (d: Designation) => hasCapability("issueGatePass", d);
/**
 * Take repaired equipment back in. Defaults to the Purchase Officer (receives
 * deliveries) plus the OM / RYK Lab Manager who owns the asset.
 */
export const canReceiveRepair = (d: Designation) => hasCapability("receiveRepair", d);
/** Materials register (chemicals/CRM/glassware/lab supplies) + certificate intake. */
export const canManageMaterials = (d: Designation) => hasCapability("manageMaterials", d);

/** Client invoices (SSOT §5). */
export const canIssueInvoice = (d: Designation) => hasCapability("issueInvoice", d);
/** Incoming client payments (D6). */
export const canRecordPayment = (d: Designation) => hasCapability("recordPayment", d);
/** Finance ledger/reports visibility. */
export const canViewFinance = (d: Designation) => hasCapability("viewFinance", d);
/** Salary structures and payroll runs; COO approves. */
export const canManagePayroll = (d: Designation) => hasCapability("managePayroll", d);
export const canApprovePayroll = (d: Designation) => hasCapability("approvePayroll", d);

/**
 * Access to the generic Admin panel (view/edit/delete any record, and the
 * capability matrix itself). Deliberately NOT configurable — hard-wired to
 * ADMIN so the super-admin can never be locked out of their own controls.
 */
export const canAdminister = (d: Designation) => d === "ADMIN";

/** Propose/manage test parameters. */
export const canManageParameters = (d: Designation) => hasCapability("manageParameters", d);
/** Approve parameters (makes them available for samples). */
export const canApproveParameter = (d: Designation) => hasCapability("approveParameter", d);
/** Manage conformity standards (acceptance limits). */
export const canManageStandards = (d: Designation) => hasCapability("manageStandards", d);

/** Access the BTF Quality Control portal. */
export const canAccessProductionQc = (d: Designation) => hasCapability("accessProductionQc", d);
/** Book/assign production-QC lots + set specs. */
export const canManageProductionQc = (d: Designation) => hasCapability("manageProductionQc", d);
/** Submit a QC result (assignment is enforced in the action). */
export const canSubmitResult = (d: Designation) => hasCapability("submitResult", d);
/** Review/approve production-QC results. */
export const canApproveLot = (d: Designation) => hasCapability("approveLot", d);

/** Create/manage client quotations for testing (sales/front-office roles). */
export const canManageQuotations = (d: Designation) => hasCapability("manageQuotations", d);
