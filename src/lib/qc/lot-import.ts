import { judge } from "@/lib/qc/spec";

/**
 * Parsing and validating a bulk QC-lot spreadsheet.
 *
 * Kept pure — no Prisma, no session — so the rules are unit-testable and the
 * server action is left doing only I/O. The generic admin importer is not used
 * here because it maps columns straight onto scalar fields from the Prisma
 * DMMF: it has no way to turn a "Raw Zinc" cell into a productTypeId, and its
 * facility stamp comes from the actor, which for an ADMIN is Lahore rather than
 * the RYK facility this section lives in.
 */

export interface LotProduct {
  id: string;
  name: string;
  specMin: number | null;
  specMax: number | null;
}

export interface LotIssue {
  /** 1-based row as it appears in Excel, so the operator can go straight to it. */
  row: number;
  column: string | null;
  message: string;
}

export interface PlannedLot {
  productTypeId: string;
  refNo: string;
  producedOn: Date | null;
  quantity: number | null;
  quantityUnit: string | null;
  source: string | null;
  note: string | null;
  resultValue: number | null;
  verdict: "PASS" | "FAIL" | null;
  /** A lot with a result is historical and already judged; one without awaits testing. */
  status: "BOOKED" | "APPROVED";
}

export interface LotImportPlan {
  rows: PlannedLot[];
  issues: LotIssue[];
  totalRows: number;
}

/** Column headings, in template order. Matching is case- and space-insensitive. */
export const LOT_COLUMNS = [
  { key: "product", label: "Product", required: true },
  { key: "refNo", label: "Vehicle / Batch No", required: true },
  { key: "producedOn", label: "Produced On", required: false },
  { key: "quantity", label: "Quantity", required: false },
  { key: "quantityUnit", label: "Quantity Unit", required: false },
  { key: "source", label: "Source", required: false },
  { key: "result", label: "Result", required: false },
  { key: "note", label: "Note", required: false },
] as const;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Excel serial date → JS Date. Mirrors `xlsx/read.ts`, including the 1900 leap
 * bug: Excel thinks 1900 was a leap year, so serials are offset by two days.
 */
function fromSerial(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A bare number is an Excel serial, not a year.
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const d = fromSerial(parseFloat(trimmed));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Turn a sheet into rows ready to insert, collecting a problem per bad row
 * rather than failing the whole file — an operator fixing a 500-row sheet needs
 * every complaint at once, not the first one.
 */
export function planLotImport(
  sheetRows: string[][],
  products: LotProduct[],
): LotImportPlan {
  const issues: LotIssue[] = [];
  const rows: PlannedLot[] = [];

  if (sheetRows.length === 0)
    return { rows, issues: [{ row: 1, column: null, message: "The sheet is empty." }], totalRows: 0 };

  const header = sheetRows[0].map(norm);
  const at = (key: string) => {
    const col = LOT_COLUMNS.find((c) => c.key === key)!;
    return header.indexOf(norm(col.label));
  };
  const index = Object.fromEntries(
    LOT_COLUMNS.map((c) => [c.key, at(c.key)]),
  ) as Record<(typeof LOT_COLUMNS)[number]["key"], number>;

  for (const c of LOT_COLUMNS) {
    if (c.required && index[c.key] === -1)
      issues.push({ row: 1, column: c.label, message: `Missing required column "${c.label}".` });
  }
  if (issues.length > 0) return { rows, issues, totalRows: 0 };

  // Products are matched on name, case-insensitively, because that is what a
  // person types. A duplicate name within a facility is impossible — the model
  // is @@unique([facilityId, name]).
  const byName = new Map(products.map((p) => [norm(p.name), p]));

  const dataRows = sheetRows.slice(1);
  let totalRows = 0;

  dataRows.forEach((cells, i) => {
    const excelRow = i + 2; // +1 for the header, +1 because Excel is 1-based
    const cell = (key: keyof typeof index) => {
      const at = index[key];
      return at === -1 ? "" : (cells[at] ?? "").trim();
    };

    // A row that is entirely blank is spreadsheet padding, not an error.
    if (cells.every((c) => !c || !c.trim())) return;
    totalRows += 1;

    const productName = cell("product");
    const refNo = cell("refNo");
    if (!productName) {
      issues.push({ row: excelRow, column: "Product", message: "Product is required." });
      return;
    }
    const product = byName.get(norm(productName));
    if (!product) {
      issues.push({
        row: excelRow,
        column: "Product",
        message: `No product type named "${productName}". Add it in Settings first.`,
      });
      return;
    }
    if (!refNo) {
      issues.push({
        row: excelRow,
        column: "Vehicle / Batch No",
        message: "Vehicle / Batch No is required.",
      });
      return;
    }

    const producedRaw = cell("producedOn");
    const producedOn = parseDate(producedRaw);
    if (producedRaw && !producedOn) {
      issues.push({
        row: excelRow,
        column: "Produced On",
        message: `"${producedRaw}" is not a date.`,
      });
      return;
    }

    const num = (key: keyof typeof index, label: string): number | null | false => {
      const raw = cell(key);
      if (!raw) return null;
      const n = parseFloat(raw);
      if (!Number.isFinite(n)) {
        issues.push({ row: excelRow, column: label, message: `"${raw}" is not a number.` });
        return false;
      }
      return n;
    };

    const quantity = num("quantity", "Quantity");
    if (quantity === false) return;
    const resultValue = num("result", "Result");
    if (resultValue === false) return;

    rows.push({
      productTypeId: product.id,
      refNo,
      producedOn,
      quantity,
      quantityUnit: cell("quantityUnit") || null,
      source: cell("source") || null,
      note: cell("note") || null,
      resultValue,
      // Judged by the product's own spec, never by a column.
      verdict:
        resultValue === null ? null : judge(resultValue, product.specMin, product.specMax),
      status: resultValue === null ? "BOOKED" : "APPROVED",
    });
  });

  return { rows, issues, totalRows };
}

/** Header row plus one worked example, for the downloadable template. */
export function lotTemplateRows(sample?: string): (string | number)[][] {
  return [
    LOT_COLUMNS.map((c) => c.label),
    [sample ?? "Raw Zinc", "TRK-1043", "2026-09-01", 30, "ton", "Supplier A", 28.4, ""],
  ];
}
