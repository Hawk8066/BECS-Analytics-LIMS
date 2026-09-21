"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextCounter } from "@/lib/numbering";
import { readWorkbook } from "@/lib/xlsx/read";
import { planLotImport, type LotIssue } from "@/lib/qc/lot-import";
import { RESET_PHRASE } from "@/lib/qc/constants";

const MAX_ROWS = 5000;
const MAX_ISSUES = 50;

export interface LotImportState {
  ran?: boolean;
  mode?: "validate" | "import";
  error?: string;
  totalRows?: number;
  validRows?: number;
  imported?: number;
  issues?: LotIssue[];
  moreIssues?: number;
}

async function requireAdmin() {
  const actor = await requireUser();
  if (!canAdminister(actor.designation))
    throw new Error("Forbidden: application admin access required.");
  return actor;
}

/** Production QC lives at RYK — never the actor's own facility (ADMIN is Lahore). */
async function rykFacility() {
  const f = await prisma.facility.findFirst({
    where: { code: "RYK" },
    select: { id: true, code: true },
  });
  if (!f) throw new Error("The RYK facility does not exist.");
  return f;
}

/**
 * Bulk-load QC lots from a spreadsheet.
 *
 * Two modes off one upload: "validate" reports what would happen and writes
 * nothing, "import" commits. Validating first is the point — a 500-row sheet
 * with a misspelled product name should tell you all of them before anything
 * lands, not fail on row 3.
 */
export async function importQcLots(
  _prev: LotImportState,
  formData: FormData,
): Promise<LotImportState> {
  const actor = await requireAdmin();
  const mode = formData.get("mode") === "import" ? "import" : "validate";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ran: true, mode, error: "Choose an .xlsx file." };

  let sheetRows: string[][];
  try {
    const sheets = readWorkbook(Buffer.from(await file.arrayBuffer()));
    if (sheets.length === 0) return { ran: true, mode, error: "That workbook has no sheets." };
    sheetRows = sheets[0].rows;
  } catch (e) {
    return {
      ran: true,
      mode,
      error: e instanceof Error ? e.message : "Could not read that file.",
    };
  }

  const facility = await rykFacility();
  const products = await prisma.productType.findMany({
    where: { facilityId: facility.id },
    select: { id: true, name: true, specMin: true, specMax: true },
  });
  if (products.length === 0)
    return {
      ran: true,
      mode,
      error: "No product types exist yet. Add at least one before importing lots.",
    };

  const plan = planLotImport(sheetRows, products);
  const base: LotImportState = {
    ran: true,
    mode,
    totalRows: plan.totalRows,
    validRows: plan.rows.length,
    issues: plan.issues.slice(0, MAX_ISSUES),
    moreIssues: Math.max(0, plan.issues.length - MAX_ISSUES),
  };

  if (plan.totalRows > MAX_ROWS)
    return { ...base, error: `That sheet has ${plan.totalRows} rows; the limit is ${MAX_ROWS}.` };
  if (mode === "validate") return base;
  if (plan.rows.length === 0)
    return { ...base, error: "Nothing to import — every row has a problem." };

  // Lot numbers come from the same gap-free counter the booking form uses, so
  // imported and hand-booked lots share one sequence rather than colliding.
  const year = new Date().getFullYear();
  const counterKey = `QCLOT:${facility.code}:${year}`;
  const numbers: string[] = [];
  for (let i = 0; i < plan.rows.length; i += 1) {
    const n = await nextCounter(counterKey);
    numbers.push(`${facility.code}-QC-${year}-${String(n).padStart(4, "0")}`);
  }

  const created = await prisma.qcLot.createMany({
    data: plan.rows.map((r, i) => ({
      lotNo: numbers[i],
      productTypeId: r.productTypeId,
      refNo: r.refNo,
      producedOn: r.producedOn,
      quantity: r.quantity,
      quantityUnit: r.quantityUnit,
      source: r.source,
      note: r.note,
      status: r.status,
      resultValue: r.resultValue,
      verdict: r.verdict,
      bookedById: actor.id,
      // An imported lot that carries a result is historical and already
      // settled. It needs testedAt/approvedAt or the monthly invoice would
      // never pick it up: the generator selects on APPROVED *and* approvedAt.
      testedById: r.resultValue === null ? null : actor.id,
      testedAt: r.resultValue === null ? null : (r.producedOn ?? new Date()),
      approvedById: r.status === "APPROVED" ? actor.id : null,
      approvedAt: r.status === "APPROVED" ? (r.producedOn ?? new Date()) : null,
      facilityId: facility.id,
    })),
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "QcLot",
    entityId: `bulk:${numbers[0]}..${numbers[numbers.length - 1]}`,
    after: { imported: created.count, skipped: plan.issues.length },
    facilityId: facility.id,
  });

  revalidatePath("/btf-qc");
  revalidatePath("/btf-qc/settings");
  revalidatePath("/btf-qc/reports");
  return { ...base, imported: created.count };
}

export interface ResetState {
  ran?: boolean;
  error?: string;
  deletedLots?: number;
  deletedInvoices?: number;
  deletedEntries?: number;
}

/**
 * Delete every QC lot, and the consolidated invoices raised from them.
 *
 * This exists for setting an environment up, where the register is test data
 * that needs clearing between trial imports. It is destructive on purpose and
 * gated three ways: ADMIN only, a typed confirmation phrase, and a refusal when
 * money is involved.
 *
 * That last one is not a policy choice — `Payment.invoiceId` is ON DELETE
 * RESTRICT, so the database itself will not drop an invoice that has been paid
 * against. Checking first turns a raw constraint error into a sentence.
 *
 * Journal entries are removed with their lines in one transaction. Taking both
 * together is what keeps the ledger balanced: dropping an entry but leaving its
 * lines, or vice versa, would break the Σdebits = Σcredits invariant that
 * `data-integrity.test.ts` asserts.
 */
export async function resetQcLots(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const actor = await requireAdmin();

  if (String(formData.get("confirm") ?? "").trim() !== RESET_PHRASE)
    return { ran: true, error: `Type ${RESET_PHRASE} exactly to confirm.` };

  const facility = await rykFacility();

  const lots = await prisma.qcLot.findMany({
    where: { facilityId: facility.id },
    select: { id: true, invoiceId: true },
  });
  if (lots.length === 0) return { ran: true, deletedLots: 0 };

  const invoiceIds = [
    ...new Set(lots.map((l) => l.invoiceId).filter((id): id is string => !!id)),
  ];

  const invoices = invoiceIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          invoiceNo: true,
          journalEntryId: true,
          _count: { select: { payments: true } },
        },
      })
    : [];

  const paid = invoices.filter((i) => i._count.payments > 0);
  if (paid.length > 0)
    return {
      ran: true,
      error:
        `Refusing: ${paid.map((i) => i.invoiceNo).join(", ")} ` +
        `${paid.length === 1 ? "has" : "have"} payments recorded. Money received cannot be ` +
        "un-invoiced here — reverse the payment in Finance first.",
    };

  const entryIds = invoices
    .map((i) => i.journalEntryId)
    .filter((id): id is string => !!id);

  await prisma.$transaction(async (tx) => {
    // Lots first: QcLotLink cascades, and clearing them frees the invoices.
    await tx.qcLot.deleteMany({ where: { id: { in: lots.map((l) => l.id) } } });
    if (invoices.length > 0)
      // InvoiceItem cascades with its invoice.
      await tx.invoice.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } });
    if (entryIds.length > 0) {
      await tx.journalLine.deleteMany({ where: { entryId: { in: entryIds } } });
      await tx.journalEntry.deleteMany({ where: { id: { in: entryIds } } });
    }
  });

  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "QcLot",
    entityId: `reset:${facility.code}`,
    before: {
      lots: lots.length,
      invoices: invoices.map((i) => i.invoiceNo),
      journalEntries: entryIds.length,
    },
    facilityId: facility.id,
  });

  revalidatePath("/btf-qc");
  revalidatePath("/btf-qc/settings");
  revalidatePath("/btf-qc/reports");
  revalidatePath("/app/finance/invoices");
  return {
    ran: true,
    deletedLots: lots.length,
    deletedInvoices: invoices.length,
    deletedEntries: entryIds.length,
  };
}
