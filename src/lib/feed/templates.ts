import type { CapabilityKey } from "@/lib/auth/capabilities";

/**
 * The feed template registry — every notification and news-reel line in the app.
 *
 * TWO RULES, both load-bearing:
 *
 * 1. BLINDING IS STRUCTURAL. `render` receives only *safe* params; its parameter
 *    type does not contain client/vendor identity, so it physically cannot print
 *    one. A template that has identity to show declares `renderIdentified`, whose
 *    parameter type adds those fields. `src/lib/feed/render.ts` is the only caller
 *    of either and picks between them with `canSeeClientIdentity(viewer)` — so
 *    blinding is evaluated per *reader*, at read time, and stays correct if the
 *    capability is reassigned in Admin › Roles.
 *
 * 2. `audience` IS THE CAPABILITY THAT GATES READING THE UNDERLYING PAGE — never
 *    the one that gates performing the action. Finance lines use `viewFinance`,
 *    not `recordPayment`. Otherwise the reel becomes a lateral channel that
 *    surfaces data from pages the viewer is not allowed to open.
 *
 * Params are stored denormalised at emit time (PR number, coded lab id, amounts)
 * so rendering never needs a second lookup. Text is NOT stored — editing a
 * template retroactively fixes wording, which is fine because the immutable
 * record of what happened is `AuditLog`, and this is explicitly not that.
 */

export type FeedKind =
  | "PERSONNEL"
  | "TESTING"
  | "PROCUREMENT"
  | "STORES"
  | "EQUIPMENT"
  | "FINANCE"
  | "QC"
  | "PARTIES";

/**
 * Constraint for a template. `render: (p: never) => string` accepts any concrete
 * parameter type (contravariance) while forbidding `any`, so each template keeps
 * its own precise param type for `ParamsOf` to read back.
 */
interface TemplateShape {
  kind: FeedKind;
  audience: CapabilityKey;
  render: (p: never) => string;
  renderIdentified?: (p: never) => string;
  href: (p: never) => string;
  /** Opt-in role fan-out for interrupt-worthy events. Hard-capped in publish(). */
  fanOut?: boolean;
}

export const TEMPLATES = {
  // --- Personnel -------------------------------------------------------------
  profileSubmitted: {
    kind: "PERSONNEL",
    audience: "approveProfile",
    render: (p: { who: string; userId: string }) =>
      `${p.who} submitted their profile for approval`,
    href: (p: { userId: string }) => `/app/personnel/${p.userId}`,
  },
  profileApproved: {
    kind: "PERSONNEL",
    audience: "managePersonnel",
    render: (p: { who: string; userId: string }) => `${p.who}'s profile approved`,
    href: (p: { userId: string }) => `/app/personnel/${p.userId}`,
  },
  leaveApplied: {
    kind: "PERSONNEL",
    audience: "approveLeave",
    render: (p: { who: string; type: string }) =>
      `${p.who} applied for ${p.type.toLowerCase()} leave`,
    href: () => `/app/leave`,
  },
  leaveDecided: {
    kind: "PERSONNEL",
    audience: "approveLeave",
    render: (p: { who: string; status: string }) =>
      `Leave for ${p.who} ${p.status.toLowerCase()}`,
    href: () => `/app/leave`,
  },
  authorizationGranted: {
    kind: "PERSONNEL",
    audience: "grantAuthorization",
    render: (p: { who: string; fn: string; userId: string }) =>
      `${p.who} authorised for ${p.fn}`,
    href: (p: { userId: string }) => `/app/personnel/${p.userId}`,
  },
  authorizationRevoked: {
    kind: "PERSONNEL",
    audience: "grantAuthorization",
    render: (p: { who: string; fn: string; userId: string }) =>
      `${p.who}'s authorisation for ${p.fn} revoked`,
    href: (p: { userId: string }) => `/app/personnel/${p.userId}`,
  },

  // --- Samples & testing (coded lab IDs only — never client identity) --------
  sampleRegistered: {
    kind: "TESTING",
    audience: "coordinateTesting",
    render: (p: { labId: string; sampleId: string; count: number }) =>
      `Sample ${p.labId} registered with ${p.count} parameter(s)`,
    href: (p: { sampleId: string }) => `/app/samples/${p.sampleId}`,
  },
  sampleAssigned: {
    kind: "TESTING",
    audience: "coordinateTesting",
    render: (p: { labId: string; sampleId: string; count: number }) =>
      `${p.count} parameter(s) on ${p.labId} assigned`,
    href: (p: { sampleId: string }) => `/app/samples/${p.sampleId}`,
  },
  sampleResultsEntered: {
    kind: "TESTING",
    audience: "coordinateTesting",
    render: (p: { labId: string; sampleId: string }) =>
      `All results entered for ${p.labId} — awaiting verification`,
    href: (p: { sampleId: string }) => `/app/samples/${p.sampleId}`,
  },
  sampleVerified: {
    kind: "TESTING",
    audience: "coordinateTesting",
    render: (p: { labId: string; sampleId: string }) =>
      `${p.labId} verified — awaiting COO approval`,
    href: (p: { sampleId: string }) => `/app/samples/${p.sampleId}`,
  },
  sampleApproved: {
    kind: "TESTING",
    audience: "coordinateTesting",
    render: (p: { labId: string; sampleId: string; reportNo: string }) =>
      `${p.labId} approved — report ${p.reportNo} released`,
    href: (p: { sampleId: string }) => `/app/samples/${p.sampleId}`,
  },

  // --- Procurement -----------------------------------------------------------
  prRaised: {
    kind: "PROCUREMENT",
    audience: "verifyPR",
    render: (p: { prNo: string; prId: string; lines: number }) =>
      `${p.prNo} raised (${p.lines} line item(s)) — awaiting verification`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },
  prVerified: {
    kind: "PROCUREMENT",
    audience: "approvePR",
    render: (p: { prNo: string; prId: string }) =>
      `${p.prNo} verified — awaiting COO approval`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },
  prApproved: {
    kind: "PROCUREMENT",
    audience: "recordQuotation",
    render: (p: { prNo: string; prId: string }) =>
      `${p.prNo} approved — quotations may be requested`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },
  prRejected: {
    kind: "PROCUREMENT",
    audience: "verifyPR",
    render: (p: { prNo: string; prId: string }) => `${p.prNo} rejected`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },
  poGenerated: {
    kind: "PROCUREMENT",
    audience: "markReceived",
    render: (p: { poNo: string; prId: string }) => `${p.poNo} issued to vendor`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },
  goodsReceived: {
    kind: "PROCUREMENT",
    audience: "inspectGoods",
    render: (p: { poNo: string; prId: string }) =>
      `Delivery received against ${p.poNo} — awaiting inspection`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },
  goodsInspected: {
    kind: "PROCUREMENT",
    audience: "manageStore",
    render: (p: { poNo: string; prId: string; decision: string }) =>
      `Delivery on ${p.poNo} ${p.decision.toLowerCase()}`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
    fanOut: true,
  },
  grnIssued: {
    kind: "STORES",
    audience: "manageStore",
    render: (p: { grnNo: string; prId: string }) =>
      `${p.grnNo} issued — goods booked into the main store`,
    href: (p: { prId: string }) => `/app/procurement/${p.prId}`,
  },

  // --- Stores ----------------------------------------------------------------
  issueRequested: {
    kind: "STORES",
    audience: "manageStore",
    render: (p: { item: string; qty: number; toStore: string }) =>
      `${p.qty} × ${p.item} requested for ${p.toStore}`,
    href: () => `/app/inventory`,
  },
  issueDecided: {
    kind: "STORES",
    audience: "manageStore",
    render: (p: { item: string; qty: number; status: string }) =>
      `Issue of ${p.qty} × ${p.item} ${p.status.toLowerCase()}`,
    href: () => `/app/inventory`,
  },

  // --- Equipment -------------------------------------------------------------
  calibrationRecorded: {
    kind: "EQUIPMENT",
    audience: "manageEquipment",
    render: (p: { equipment: string; equipmentId: string; validUntil: string }) =>
      `${p.equipment} calibrated — valid until ${p.validUntil}`,
    href: (p: { equipmentId: string }) => `/app/equipment/${p.equipmentId}`,
  },
  repairOpened: {
    kind: "EQUIPMENT",
    audience: "manageEquipment",
    render: (p: { equipment: string; repairId: string; site: string }) =>
      `${p.equipment} sent for ${p.site === "OFF_SITE" ? "off-site" : "on-site"} repair`,
    href: (p: { repairId: string }) => `/app/equipment/repairs/${p.repairId}`,
  },
  repairClosed: {
    kind: "EQUIPMENT",
    audience: "manageEquipment",
    render: (p: { equipment: string; repairId: string }) =>
      `${p.equipment} returned to service`,
    href: (p: { repairId: string }) => `/app/equipment/repairs/${p.repairId}`,
  },

  // --- Production QC (analysts hold accessProductionQc) ----------------------
  qcLotBooked: {
    kind: "QC",
    audience: "accessProductionQc",
    render: (p: { lotNo: string; lotId: string; product: string }) =>
      `QC lot ${p.lotNo} (${p.product}) booked`,
    href: (p: { lotId: string }) => `/btf-qc/${p.lotId}`,
  },
  qcResultSubmitted: {
    kind: "QC",
    audience: "accessProductionQc",
    render: (p: { lotNo: string; lotId: string }) =>
      `QC lot ${p.lotNo} submitted for review`,
    href: (p: { lotId: string }) => `/btf-qc/${p.lotId}`,
  },
  qcLotDecided: {
    kind: "QC",
    audience: "accessProductionQc",
    render: (p: { lotNo: string; lotId: string; status: string }) =>
      `QC lot ${p.lotNo} ${p.status.toLowerCase()}`,
    href: (p: { lotId: string }) => `/btf-qc/${p.lotId}`,
  },

  // --- Finance ---------------------------------------------------------------
  invoiceIssued: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { invoiceNo: string; invoiceId: string; amount: string }) =>
      `Invoice ${p.invoiceNo} issued — PKR ${p.amount}`,
    href: (p: { invoiceId: string }) => `/app/finance/invoices/${p.invoiceId}`,
  },
  paymentReceived: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { invoiceNo: string; invoiceId: string; amount: string }) =>
      `Payment of PKR ${p.amount} received against ${p.invoiceNo}`,
    href: (p: { invoiceId: string }) => `/app/finance/invoices/${p.invoiceId}`,
  },
  vendorBillRecorded: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { billNo: string; billId: string; amount: string }) =>
      `Vendor bill ${p.billNo} recorded — PKR ${p.amount}`,
    href: (p: { billId: string }) => `/app/finance/vendor-bills/${p.billId}`,
  },
  vendorPaymentRecorded: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { billNo: string; billId: string; amount: string }) =>
      `PKR ${p.amount} paid against vendor bill ${p.billNo}`,
    href: (p: { billId: string }) => `/app/finance/vendor-bills/${p.billId}`,
  },
  outsourceBillRecorded: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { billNo: string; billId: string; amount: string }) =>
      `External-lab bill ${p.billNo} recorded — PKR ${p.amount}`,
    href: (p: { billId: string }) => `/app/finance/outsource-bills/${p.billId}`,
  },
  outsourcePaymentRecorded: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { billNo: string; billId: string; amount: string }) =>
      `PKR ${p.amount} paid against external-lab bill ${p.billNo}`,
    href: (p: { billId: string }) => `/app/finance/outsource-bills/${p.billId}`,
  },
  expenseRecorded: {
    kind: "FINANCE",
    audience: "viewFinance",
    render: (p: { category: string; amount: string }) =>
      `${p.category} expense recorded — PKR ${p.amount}`,
    href: () => `/app/finance/expenses`,
  },
  payrollRunPrepared: {
    kind: "FINANCE",
    audience: "approvePayroll",
    render: (p: { runNo: string; runId: string; employees: number }) =>
      `Payroll ${p.runNo} prepared for ${p.employees} employee(s) — awaiting approval`,
    href: (p: { runId: string }) => `/app/finance/payroll/${p.runId}`,
  },
  payrollRunApproved: {
    kind: "FINANCE",
    audience: "managePayroll",
    render: (p: { runNo: string; runId: string }) =>
      `Payroll ${p.runNo} approved and posted`,
    href: (p: { runId: string }) => `/app/finance/payroll/${p.runId}`,
  },

  // --- Parties (the blinding split lives here) -------------------------------
  clientRegistered: {
    kind: "PARTIES",
    audience: "registerClient",
    // `render` cannot name the client: `company` is not in its parameter type.
    render: (p: { clientNo: string; clientId: string }) =>
      `Client ${p.clientNo} registered`,
    renderIdentified: (p: {
      clientNo: string;
      clientId: string;
      company: string;
    }) => `Client ${p.clientNo} — ${p.company} — registered`,
    href: (p: { clientId: string }) => `/app/clients/${p.clientId}`,
  },
  vendorRegistered: {
    kind: "PARTIES",
    audience: "registerVendor",
    render: (p: { vendorNo: string; vendorId: string; company: string }) =>
      `Vendor ${p.vendorNo} — ${p.company} — registered`,
    href: (p: { vendorId: string }) => `/app/vendors/${p.vendorId}`,
  },
} as const satisfies Record<string, TemplateShape>;

export type TemplateKey = keyof typeof TEMPLATES;

/**
 * The params a template needs. When a template can show identity, the identified
 * signature is the wider one, so callers must supply those fields too — the
 * reader decides at render time whether they are shown.
 */
export type ParamsOf<K extends TemplateKey> = (typeof TEMPLATES)[K] extends {
  renderIdentified: (p: infer I) => string;
}
  ? I
  : (typeof TEMPLATES)[K] extends { render: (p: infer S) => string }
    ? S
    : never;
