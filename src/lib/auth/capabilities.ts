import type { Designation } from "@prisma/client";

/**
 * The Tier-1 capability catalog — the single list of "what can be done" in the
 * app, with the built-in default set of designations for each.
 *
 * `perms.ts` reads this (via capability-store.ts) instead of hard-coding role
 * checks, so the super-admin can re-assign any capability to any designation
 * from Admin › Roles. A capability with no stored override falls back to the
 * `defaults` below, which reproduce the original hard-coded matrix exactly.
 *
 * Two invariants:
 *   - `ADMIN` implicitly passes every capability and is never listed/stored.
 *   - `administer` (the Admin panel itself) is NOT configurable — it stays
 *     ADMIN-only so the super-admin can never be locked out.
 */

export interface CapabilityDef {
  key: string;
  /** What the holder can do, in the language of the SSOT role matrix. */
  label: string;
  /** Module grouping for the admin screen. */
  group: string;
  /** Built-in designation set used when there is no stored override. */
  defaults: readonly Designation[];
}

/** Designations the matrix can assign. Excludes ADMIN (implicit) and the
 *  external portal logins (CLIENT/VENDOR/OUTSOURCE_LAB), which are redirected
 *  out of the staff app entirely. */
export const ASSIGNABLE_DESIGNATIONS: Designation[] = [
  "COO",
  "OPERATIONS_MANAGER",
  "LAB_MANAGER_RYK",
  "ANALYST",
  "ANALYST_RYK",
  "LAB_ASSISTANT",
  "LAB_ATTENDANT",
  "LIAISON_OFFICER",
  "ACCOUNTANT",
  "PURCHASE_OFFICER",
  "STORE_INCHARGE",
  "IT_OFFICER",
  "SALES_MARKETING_OFFICER",
];

const OM = "OPERATIONS_MANAGER" as const;
const RYK = "LAB_MANAGER_RYK" as const;
const LO = "LIAISON_OFFICER" as const;
const COO = "COO" as const;

export const CAPABILITIES = [
  // --- Personnel & authorization ---------------------------------------------
  { key: "managePersonnel", group: "Personnel", label: "Create/edit personnel profile shells", defaults: [OM, COO] },
  { key: "approveProfile", group: "Personnel", label: "Approve a profile (activates the account)", defaults: [COO] },
  { key: "manageFunctions", group: "Personnel", label: "Create/edit Functions", defaults: [OM, COO] },
  { key: "approveFunction", group: "Personnel", label: "Approve a Function", defaults: [COO] },
  { key: "evaluateCompetence", group: "Personnel", label: "Record competence evaluations", defaults: [OM, COO, RYK] },
  { key: "grantAuthorization", group: "Personnel", label: "Grant / revoke Authorizations", defaults: [COO] },
  { key: "approveLeave", group: "Personnel", label: "Approve / reject leave applications", defaults: [OM, COO, RYK] },

  // --- Clients, samples & testing --------------------------------------------
  { key: "registerClient", group: "Samples & Testing", label: "Register/edit clients, third parties, client portals", defaults: [LO, COO] },
  { key: "registerSample", group: "Samples & Testing", label: "Register samples", defaults: [LO, RYK, COO] },
  { key: "coordinateTesting", group: "Samples & Testing", label: "Assign parameters to analysts and verify results", defaults: [OM, RYK, COO] },
  { key: "approveSample", group: "Samples & Testing", label: "Approve results → release the final report", defaults: [COO] },
  { key: "seeClientIdentity", group: "Samples & Testing", label: "See client identity on samples (decode / un-blind)", defaults: [LO] },
  { key: "manageParameters", group: "Samples & Testing", label: "Manage test parameters, prices and packages", defaults: [OM, LO, RYK, COO] },
  { key: "approveParameter", group: "Samples & Testing", label: "Approve parameters (makes them usable)", defaults: [COO] },
  { key: "manageStandards", group: "Samples & Testing", label: "Manage conformity standards and limits", defaults: [OM, LO, RYK, COO] },

  // --- Procurement ------------------------------------------------------------
  { key: "verifyPR", group: "Procurement", label: "Verify / reject Purchase Requests", defaults: [OM, RYK, COO] },
  { key: "approvePR", group: "Procurement", label: "Approve Purchase Requests", defaults: [COO] },
  { key: "recordQuotation", group: "Procurement", label: "Record vendor quotations", defaults: ["PURCHASE_OFFICER", COO] },
  { key: "selectQuotation", group: "Procurement", label: "Select the winning quotation (comparative)", defaults: [COO] },
  { key: "generatePO", group: "Procurement", label: "Generate Purchase Orders", defaults: ["PURCHASE_OFFICER", COO] },
  { key: "markReceived", group: "Procurement", label: "Mark goods received against a PO", defaults: ["PURCHASE_OFFICER", COO] },
  { key: "inspectGoods", group: "Procurement", label: "Inspect delivered goods (accept / reject)", defaults: [OM, RYK, COO] },
  { key: "registerVendor", group: "Procurement", label: "Register/edit vendors and vendor portals", defaults: ["ACCOUNTANT", COO] },

  // --- Stores & inventory ------------------------------------------------------
  { key: "manageStore", group: "Stores & Inventory", label: "Issue GRNs, add stock, set thresholds, approve issue requests", defaults: ["STORE_INCHARGE", COO] },
  { key: "manageMaterials", group: "Stores & Inventory", label: "Register materials + CoA/MSDS/certificates", defaults: [OM, RYK, "STORE_INCHARGE", COO] },

  // --- Equipment ---------------------------------------------------------------
  { key: "manageEquipment", group: "Equipment", label: "Equipment register, calibration, qualification, repairs", defaults: [OM, RYK, COO] },
  { key: "issueGatePass", group: "Equipment", label: "Issue a gate pass (equipment leaves the premises)", defaults: ["STORE_INCHARGE", OM, RYK, COO] },
  { key: "receiveRepair", group: "Equipment", label: "Receive repaired equipment back", defaults: ["PURCHASE_OFFICER", OM, RYK, COO] },

  // --- Finance -----------------------------------------------------------------
  { key: "viewFinance", group: "Finance", label: "View ledger, statements and counterparty balances", defaults: ["ACCOUNTANT", COO, OM] },
  { key: "manageQuotations", group: "Finance", label: "Create/manage client quotations", defaults: [LO, "ACCOUNTANT", "SALES_MARKETING_OFFICER", COO] },
  { key: "issueInvoice", group: "Finance", label: "Issue client invoices", defaults: [LO, "ACCOUNTANT", COO] },
  { key: "recordPayment", group: "Finance", label: "Record payments (client, vendor, outsource)", defaults: ["ACCOUNTANT", LO, COO] },
  { key: "manageOutsourceBilling", group: "Finance", label: "Record vendor bills, external-lab bills and expenses", defaults: ["ACCOUNTANT", COO] },
  { key: "registerOutsourceLab", group: "Finance", label: "Register outsource (subcontractor) labs", defaults: [OM, RYK, LO, COO] },
  { key: "setOutsourcePrice", group: "Finance", label: "Set what an outsource lab charges per test", defaults: [OM, RYK, LO, COO, "ACCOUNTANT"] },
  { key: "managePayroll", group: "Finance", label: "Set salary structures and prepare payroll runs", defaults: ["ACCOUNTANT", COO] },
  { key: "approvePayroll", group: "Finance", label: "Approve a payroll run (posts to the GL)", defaults: [COO] },

  // --- Production QC -----------------------------------------------------------
  { key: "accessProductionQc", group: "Production QC", label: "Access the production-QC portal", defaults: [COO, OM, RYK, "ANALYST", "ANALYST_RYK"] },
  { key: "manageProductionQc", group: "Production QC", label: "Book/assign QC lots and set product specs", defaults: [RYK, OM, COO] },
  { key: "submitResult", group: "Production QC", label: "Submit a QC result", defaults: ["ANALYST", "ANALYST_RYK", RYK, OM, COO] },
  { key: "approveLot", group: "Production QC", label: "Approve / reject a QC lot", defaults: [RYK, COO] },
] as const satisfies readonly CapabilityDef[];

/**
 * The literal union of every capability key. Feed templates and task providers
 * declare their audience as a `CapabilityKey`, so a typo or a renamed capability
 * is a compile error rather than a silently invisible feed line.
 */
export type CapabilityKey = (typeof CAPABILITIES)[number]["key"];

export const CAPABILITY_BY_KEY = new Map<string, CapabilityDef>(
  CAPABILITIES.map((c) => [c.key, c]),
);

/** Catalog groups in display order. */
export const CAPABILITY_GROUPS: string[] = [
  ...new Set(CAPABILITIES.map((c) => c.group)),
];

/** True when `set` is exactly the built-in default for `key` (order-insensitive). */
export function isDefaultSet(key: string, set: readonly Designation[]): boolean {
  const def = CAPABILITY_BY_KEY.get(key)?.defaults ?? [];
  if (def.length !== set.length) return false;
  const a = new Set(def);
  return set.every((d) => a.has(d));
}
