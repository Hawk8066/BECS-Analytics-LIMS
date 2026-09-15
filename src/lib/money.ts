/**
 * Money columns are stored as PKR paisa (Int), but people write rupees.
 *
 * The price editors already convert on manual entry (see toPaisa in
 * lib/actions/parameters.ts). This is that same rule made available to the
 * generic Excel importer/exporter, which otherwise writes the raw cell through
 * and leaves every uploaded price 100x too small — the reason
 * prisma/_tmp-fix-parameter-price.ts had to exist.
 *
 * Fields are listed explicitly rather than sniffed from their names: a wrong
 * guess here multiplies real money by 100.
 */
import { CoerceError } from "@/lib/admin/values";

/** Prisma model -> fields holding PKR paisa. Kept in step with schema.prisma. */
export const PAISA_FIELDS: Record<string, readonly string[]> = {
  Expense: ["amount"],
  Invoice: ["amount"],
  JournalLine: ["debit", "credit"],
  OutsourceBill: ["subtotal", "amount"],
  OutsourceBillItem: ["price"],
  OutsourceLabPrice: ["price"],
  OutsourcePayment: ["amount"],
  PackageSectorPrice: ["price", "urgentPrice"],
  Parameter: ["price", "urgentPrice"],
  ParameterSectorPrice: ["price", "urgentPrice"],
  Payment: ["amount"],
  PayrollItem: ["gross", "cashAllowance", "incomeTax", "providentFund", "eobi", "advances", "netPay"],
  PurchaseOrder: ["amount"],
  PurchaseOrderLine: ["rate"],
  Quotation: ["amount"],
  QuotationLine: ["rate"],
  // providentFundPct is a whole-number percent, not money.
  SalaryStructure: ["basic", "houseRent", "conveyance", "medical", "otherAllowances", "cashAllowance", "eobi"],
  TestQuotation: ["subtotal"],
  TestQuotationItem: ["price"],
  VendorBill: ["subtotal", "amount"],
  VendorPayment: ["amount"],
};

const NO_FIELDS: ReadonlySet<string> = new Set();
const BY_MODEL = new Map<string, ReadonlySet<string>>(
  Object.entries(PAISA_FIELDS).map(([model, fields]) => [model, new Set(fields)]),
);

/** The paisa-valued fields of a model (empty set for models with none). */
export function paisaFields(modelName: string): ReadonlySet<string> {
  return BY_MODEL.get(modelName) ?? NO_FIELDS;
}

export function isPaisaField(modelName: string, fieldName: string): boolean {
  return paisaFields(modelName).has(fieldName);
}

/**
 * PKR rupees as a person writes them -> paisa. Blank means "unset" (null).
 * Tolerates "PKR 1,500.50" so a pasted cell doesn't fail on formatting.
 */
export function rupeesToPaisa(
  raw: string | number | null | undefined,
  label = "price",
): number | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/^(?:PKR|Rs\.?)\s*/i, "")
    .replace(/,/g, "")
    .trim();
  if (s === "") return null;

  const rupees = Number(s);
  if (!Number.isFinite(rupees)) {
    throw new CoerceError(`${label} must be an amount in PKR, e.g. 1500 or 1500.50.`);
  }
  if (rupees < 0) throw new CoerceError(`${label} cannot be negative.`);
  return Math.round(rupees * 100);
}

/** Paisa -> rupees, as written into an export cell so the file re-imports as-is. */
export function paisaToRupees(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const paisa = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(paisa) ? paisa / 100 : null;
}
