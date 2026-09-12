import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { postJournal } from "@/lib/finance/posting";
import { priceAt, priceEntry } from "@/lib/pricing";

/**
 * The RYK monthly consolidated invoice (Module 06, F-5).
 *
 * One invoice per calendar month — `INV-RYK-2026-06` — to the RYK facility's
 * client (Bio Tech Fertilizers (Pvt) Ltd, SSOT §3), billing every approved
 * production-QC lot at the rate held in the Parameters master. Prices are never
 * typed here: each ProductType points at a Parameter, and that parameter's rate
 * is what its lots are billed at, so a price change in Parameters is picked up
 * by the next run with nothing to re-enter.
 *
 * Two invariants make month-end generation safe to run from anywhere, as often
 * as it likes:
 *
 *   1. `Invoice.invoiceNo` is unique and derived purely from (facility, year,
 *      month), so a month can only ever have one invoice.
 *   2. `QcLot.invoiceId` is set when a lot is billed and the generator only
 *      selects lots where it is null, so a lot can only be billed once.
 *
 * Together they make the generator idempotent: calling it twice for the same
 * month is a no-op, and a lot approved late is swept onto the next invoice
 * rather than being lost.
 */

export const QC_FACILITY_CODE = "RYK";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const monthLabel = (year: number, month0: number) =>
  `${MONTHS[month0]} ${year}`;

/** Zero-padded month for the invoice number: June -> "06". */
const mm = (month0: number) => String(month0 + 1).padStart(2, "0");

export type MonthlyQcInvoiceStatus =
  | "CREATED" // a new invoice was raised
  | "EXISTS" // this month was already invoiced
  | "NOTHING_TO_BILL" // no billable approved lots in the period
  | "MONTH_OPEN" // the month has not ended yet
  | "NO_BILLING_CLIENT"; // the facility has no client to consolidate onto

export interface SkippedGroup {
  product: string;
  lots: number;
  reason: string;
}

export interface MonthlyQcInvoiceResult {
  status: MonthlyQcInvoiceStatus;
  invoiceNo?: string;
  invoiceId?: string;
  billedLots: number;
  amount: number; // paisa
  /** Approved but unbillable lots, grouped by product, with the reason. */
  skipped: SkippedGroup[];
}

const empty = (status: MonthlyQcInvoiceStatus): MonthlyQcInvoiceResult => ({
  status,
  billedLots: 0,
  amount: 0,
  skipped: [],
});

export type LotForBilling = {
  id: string;
  lotNo: string;
  approvedAt: Date | null;
  productType: {
    name: string;
    testParameter: string;
    parameter: {
      id: string;
      name: string;
      price: number | null;
      urgentPrice: number | null;
    } | null;
  };
};

/**
 * Approved lots not yet on an invoice, approved before `before`.
 *
 * Deliberately not restricted to lots approved *within* the month: a lot
 * approved in May but never billed (because its product had no price then) is
 * picked up by June's run. Nothing performed is ever silently dropped.
 */
export async function billableLots(
  facilityId: string,
  before: Date,
): Promise<LotForBilling[]> {
  return prisma.qcLot.findMany({
    where: {
      facilityId,
      status: "APPROVED",
      invoiceId: null,
      approvedAt: { not: null, lt: before },
    },
    orderBy: { approvedAt: "asc" },
    select: {
      id: true,
      lotNo: true,
      approvedAt: true,
      productType: {
        select: {
          name: true,
          testParameter: true,
          parameter: {
            select: { id: true, name: true, price: true, urgentPrice: true },
          },
        },
      },
    },
  });
}

/** Split lots into what can be billed and what cannot, with the reason why. */
export function partitionForBilling(lots: LotForBilling[]) {
  const billable: { lot: LotForBilling; price: number }[] = [];
  const reasons = new Map<string, SkippedGroup>();

  for (const lot of lots) {
    const p = lot.productType.parameter;
    // QC lots are routine production testing, always billed at the normal rate.
    const price = p ? priceAt(priceEntry(p), "NORMAL") : null;
    if (p && price !== null && price > 0) {
      billable.push({ lot, price });
      continue;
    }
    const reason = p
      ? `parameter "${p.name}" has no price`
      : `no parameter linked (test "${lot.productType.testParameter}")`;
    const key = `${lot.productType.name}::${reason}`;
    const seen = reasons.get(key);
    if (seen) seen.lots += 1;
    else reasons.set(key, { product: lot.productType.name, lots: 1, reason });
  }
  return { billable, skipped: [...reasons.values()] };
}

/** The invoice number a given facility/month bills under. Pure, so a page can
 * look the invoice up without going near the generator. */
export const qcInvoiceNoFor = (
  facilityCode: string,
  year: number,
  month0: number,
) => `INV-${facilityCode}-${year}-${mm(month0)}`;

export interface MonthlyQcPreview {
  invoiceNo: string;
  /** The client the month will be billed to, once one is configured. */
  billingClient: { id: string; company: string } | null;
  /** The invoice for this month, once it exists. */
  invoice: { id: string; invoiceNo: string; amount: number; lots: number } | null;
  monthClosed: boolean;
  billable: { lot: LotForBilling; price: number }[];
  amount: number; // paisa
  skipped: SkippedGroup[];
}

/**
 * What the month would bill, without billing it — for the QC reports screen.
 * Runs the same selection and pricing the generator does, so what is shown is
 * exactly what pressing the button produces.
 */
export async function previewMonthlyQcInvoice(
  year: number,
  month0: number,
): Promise<MonthlyQcPreview | null> {
  const facility = await prisma.facility.findFirst({
    where: { code: QC_FACILITY_CODE },
    select: {
      id: true,
      code: true,
      qcBillingClient: { select: { id: true, company: true } },
    },
  });
  if (!facility) return null;

  const periodEnd = new Date(year, month0 + 1, 1);
  const invoiceNo = qcInvoiceNoFor(facility.code, year, month0);

  const [invoice, lots] = await Promise.all([
    prisma.invoice.findUnique({
      where: { invoiceNo },
      select: {
        id: true,
        invoiceNo: true,
        amount: true,
        _count: { select: { qcLots: true } },
      },
    }),
    billableLots(facility.id, periodEnd),
  ]);

  const { billable, skipped } = partitionForBilling(lots);
  return {
    invoiceNo,
    billingClient: facility.qcBillingClient,
    invoice: invoice
      ? {
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          amount: invoice.amount,
          lots: invoice._count.qcLots,
        }
      : null,
    monthClosed: periodEnd <= new Date(),
    billable,
    amount: billable.reduce((s, b) => s + b.price, 0),
    skipped,
  };
}

/**
 * Raise (or return) the consolidated invoice for one calendar month.
 *
 * The month must have closed: the invoice bills a whole period, so generating
 * it early would invoice a month still being worked.
 */
export async function generateMonthlyQcInvoice(opts: {
  year: number;
  month0: number;
  actorId?: string | null;
  /** Bill a month that has not closed yet. For tests only. */
  allowOpenMonth?: boolean;
}): Promise<MonthlyQcInvoiceResult> {
  const { year, month0, actorId = null } = opts;
  const periodEnd = new Date(year, month0 + 1, 1); // exclusive
  if (!opts.allowOpenMonth && periodEnd > new Date()) return empty("MONTH_OPEN");

  const facility = await prisma.facility.findFirst({
    where: { code: QC_FACILITY_CODE },
    select: { id: true, code: true, qcBillingClientId: true },
  });
  if (!facility) return empty("NOTHING_TO_BILL");

  const invoiceNo = qcInvoiceNoFor(facility.code, year, month0);
  const existing = await prisma.invoice.findUnique({
    where: { invoiceNo },
    select: { id: true, amount: true, _count: { select: { qcLots: true } } },
  });
  if (existing)
    return {
      status: "EXISTS",
      invoiceNo,
      invoiceId: existing.id,
      billedLots: existing._count.qcLots,
      amount: existing.amount,
      skipped: [],
    };

  // The client the QC lab bills, set once on the facility (SSOT §3: Bio Tech
  // Fertilizers). Not inferred from the client's own facilityId — BECS registers
  // that company against Lahore even though the work is done at RYK — and not
  // hard-coded to a client number, which a reseed would break.
  if (!facility.qcBillingClientId) return empty("NO_BILLING_CLIENT");
  const clientId = facility.qcBillingClientId;

  const lots = await billableLots(facility.id, periodEnd);
  const { billable, skipped } = partitionForBilling(lots);
  if (billable.length === 0)
    return { ...empty("NOTHING_TO_BILL"), invoiceNo, skipped };

  const amount = billable.reduce((s, b) => s + b.price, 0);

  // Invoice first, journal second — the reverse of an ad-hoc invoice. A failure
  // between the two leaves an invoice with no journal entry (visible, and fixed
  // by posting again) rather than a journal entry pointing at an invoice that
  // does not exist, which an append-only ledger can only undo by reversal.
  let invoiceId: string;
  try {
    invoiceId = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          clientId,
          subtotal: amount,
          amount,
          memo: `Consolidated production-QC testing — ${monthLabel(year, month0)}`,
          issuedById: actorId,
          facilityId: facility.id,
          items: {
            create: billable.map(({ lot, price }) => ({
              kind: "PARAMETER",
              refId: lot.productType.parameter!.id,
              name: `${lot.lotNo} · ${lot.productType.name} — ${lot.productType.parameter!.name}`,
              price,
            })),
          },
        },
        select: { id: true },
      });

      // Re-assert invoiceId IS NULL inside the transaction: if a concurrent run
      // claimed a lot first this updates fewer rows, and the whole invoice rolls
      // back rather than billing that lot twice.
      const claimed = await tx.qcLot.updateMany({
        where: { id: { in: billable.map((b) => b.lot.id) }, invoiceId: null },
        data: { invoiceId: invoice.id },
      });
      if (claimed.count !== billable.length)
        throw new Error("Lots were billed concurrently; retry.");

      return invoice.id;
    });
  } catch (e) {
    // Another request raised this month's invoice between our check and our
    // insert. That is two pollers racing, not a failure.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const now = await prisma.invoice.findUnique({
        where: { invoiceNo },
        select: { id: true, amount: true, _count: { select: { qcLots: true } } },
      });
      if (now)
        return {
          status: "EXISTS",
          invoiceNo,
          invoiceId: now.id,
          billedLots: now._count.qcLots,
          amount: now.amount,
          skipped,
        };
    }
    throw e;
  }

  const entry = await postJournal({
    memo: `Invoice ${invoiceNo}`,
    createdById: actorId,
    lines: [
      { accountCode: "1100", debit: amount }, // Accounts Receivable
      { accountCode: "4000", credit: amount }, // Sales Revenue
    ],
  });
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { journalEntryId: entry.id },
  });

  return {
    status: "CREATED",
    invoiceNo,
    invoiceId,
    billedLots: billable.length,
    amount,
    skipped,
  };
}
