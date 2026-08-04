/**
 * Map a parsed worksheet onto a Prisma model.
 *
 * Column headers must be the exact Prisma field names (matched
 * case-insensitively and ignoring surrounding whitespace). Every cell is
 * coerced with the same `coerce()` the admin panel uses, so an imported row and
 * a hand-typed one go through identical validation.
 *
 * Nothing here touches the database — it returns rows plus a list of problems,
 * letting the caller decide whether to commit. Kept free of server-only imports
 * so the shapes can be shared with client components.
 */
import type { AdminField, AdminModel } from "@/lib/admin/registry";
import { coerce, CoerceError, displayValue as display } from "@/lib/admin/values";
import { paisaFields, rupeesToPaisa } from "@/lib/money";
import { excelSerialToDate, type Sheet } from "./read";

export interface ImportIssue {
  /** 1-based row number as it appears in Excel, or null for header problems. */
  row: number | null;
  column: string | null;
  message: string;
}

export interface MapOptions {
  /**
   * Fields the server fills in itself (facility/section stamps, generated
   * numbers). They are not required as columns, and a column supplying one is
   * still honoured.
   */
  autoFilled?: Set<string>;
}

export interface MappedSheet {
  /** Headers as written in the sheet, in column order. */
  headers: string[];
  /** Field each column maps to; null for columns that are ignored/invalid. */
  columns: Array<AdminField | null>;
  /** Coerced Prisma payloads for the rows that parsed cleanly. */
  rows: Array<Record<string, unknown>>;
  issues: ImportIssue[];
  /** Data rows seen, including ones that failed. */
  totalRows: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Fields a user may supply a column for. */
export function importableFields(model: AdminModel): AdminField[] {
  return model.fields.filter((f) => f.editable);
}

function isBlank(cells: string[]): boolean {
  return cells.every((c) => (c ?? "").trim() === "");
}

/**
 * A datetime cell may arrive as an Excel day-serial rather than a date string.
 * Convert those before coercion; leave anything else for `coerce` to parse.
 */
function normaliseDatetime(raw: string): string {
  const t = raw.trim();
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    // Serials below ~1 are times-of-day, above ~2958465 are past year 9999.
    if (n > 0 && n < 2958466) return excelSerialToDate(n).toISOString();
  }
  return t;
}

/** How many cells in this row name a field on the model. */
function headerScore(
  row: string[],
  byExact: Map<string, AdminField>,
  byLower: Map<string, AdminField>,
): number {
  let hits = 0;
  for (const cell of row) {
    const h = (cell ?? "").trim();
    if (h === "") continue;
    if (byExact.has(h) || byLower.has(norm(h))) hits++;
  }
  return hits;
}

/** Index of the best header row, or -1 if the sheet has no content at all. */
function findHeaderRow(
  rows: string[][],
  byExact: Map<string, AdminField>,
  byLower: Map<string, AdminField>,
): number {
  const HEADER_SEARCH_DEPTH = 10;
  let best = -1;
  let bestScore = 0;
  let firstNonBlank = -1;

  for (let i = 0; i < rows.length && i < HEADER_SEARCH_DEPTH; i++) {
    if (isBlank(rows[i])) continue;
    if (firstNonBlank === -1) firstNonBlank = i;
    const score = headerScore(rows[i], byExact, byLower);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  // No row looked like a header — fall back to the first row with content so
  // the caller reports "unknown column" against something meaningful.
  return best !== -1 ? best : firstNonBlank;
}

export function mapSheet(
  sheet: Sheet,
  model: AdminModel,
  options: MapOptions = {},
): MappedSheet {
  const issues: ImportIssue[] = [];
  const fields = importableFields(model);
  const autoFilled = options.autoFilled ?? new Set<string>();
  // Money columns are written in rupees but stored in paisa (see lib/money.ts).
  const money = paisaFields(model.name);

  const byExact = new Map(fields.map((f) => [f.name, f]));
  const byLower = new Map(fields.map((f) => [norm(f.name), f]));
  // Non-editable fields are still recognised, so we can explain *why* they're rejected.
  const nonEditable = new Map(
    model.fields.filter((f) => !f.editable).map((f) => [norm(f.name), f]),
  );

  // ---- locate the header row ----
  // Real-world registers often carry banner/title rows above the headings, so
  // pick the row in the first stretch of the sheet that matches the most field
  // names rather than assuming row 1.
  const headerIdx = findHeaderRow(sheet.rows, byExact, byLower);
  if (headerIdx === -1) {
    return {
      headers: [],
      columns: [],
      rows: [],
      totalRows: 0,
      issues: [{ row: null, column: null, message: "The sheet is empty." }],
    };
  }

  const headers = sheet.rows[headerIdx].map((h) => (h ?? "").trim());
  const columns: Array<AdminField | null> = [];
  const seen = new Set<string>();

  headers.forEach((h, i) => {
    if (h === "") {
      columns[i] = null;
      return;
    }
    const field = byExact.get(h) ?? byLower.get(norm(h));
    if (!field) {
      const blocked = nonEditable.get(norm(h));
      issues.push({
        row: null,
        column: h,
        message: blocked
          ? `Column "${h}" is managed automatically and cannot be imported.`
          : `Column "${h}" is not a field on ${model.name}.`,
      });
      columns[i] = null;
      return;
    }
    if (seen.has(field.name)) {
      issues.push({
        row: null,
        column: h,
        message: `Column "${field.name}" appears more than once.`,
      });
      columns[i] = null;
      return;
    }
    seen.add(field.name);
    columns[i] = field;
  });

  // ---- required fields must have a column (unless the schema defaults them) ----
  for (const f of fields) {
    if (f.isRequired && !f.hasDefault && !seen.has(f.name) && !autoFilled.has(f.name)) {
      issues.push({
        row: null,
        column: f.name,
        message: `Required column "${f.name}" is missing.`,
      });
    }
  }

  // Only unique keys whose every field is a mapped column can be checked here;
  // a key that leans on a server-stamped or generated value is left to the DB.
  const mapped = new Set(
    columns.filter((c): c is AdminField => c !== null).map((c) => c.name),
  );
  const checkableKeys = model.uniqueKeys.filter((k) => k.every((f) => mapped.has(f)));
  // Composite key string -> the Excel row that first used it.
  const firstSeen = new Map<string, number>();

  // ---- data rows ----
  const rows: Record<string, unknown>[] = [];
  let totalRows = 0;

  for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
    const cells = sheet.rows[r];
    if (isBlank(cells)) continue; // ignore spacer rows
    totalRows++;

    const excelRow = r + 1; // 1-based, as shown in Excel
    const data: Record<string, unknown> = {};
    let rowOk = true;

    columns.forEach((field, i) => {
      if (!field) return;
      const raw = (cells[i] ?? "").trim();

      // Blank + has a schema default -> let the default apply.
      if (raw === "" && field.hasDefault) return;

      if (raw === "" && field.isRequired) {
        issues.push({
          row: excelRow,
          column: field.name,
          message: `${field.name} is required.`,
        });
        rowOk = false;
        return;
      }

      if (field.type === "enum" && raw !== "") {
        const allowed = field.enumValues ?? [];
        const match = allowed.find((v) => norm(v) === norm(raw));
        if (!match) {
          issues.push({
            row: excelRow,
            column: field.name,
            message: `"${raw}" is not a valid ${field.name}. Expected one of: ${allowed.join(", ")}.`,
          });
          rowOk = false;
          return;
        }
        data[field.name] = match;
        return;
      }

      const prepared = field.type === "datetime" ? normaliseDatetime(raw) : raw;

      try {
        if (money.has(field.name)) {
          // 1500.50 in the sheet -> 150050 paisa in the column.
          data[field.name] = rupeesToPaisa(raw, field.name);
          return;
        }
        const value = coerce(field, prepared === "" ? null : prepared);
        if (value !== undefined) data[field.name] = value;
      } catch (err) {
        issues.push({
          row: excelRow,
          column: field.name,
          message: err instanceof CoerceError ? err.message : `${field.name} is invalid.`,
        });
        rowOk = false;
      }
    });

    // ---- in-file uniqueness ----
    // Mirror Postgres: a key with any NULL column can't collide (NULLs are
    // distinct), so a row missing one of the key's values is simply skipped.
    if (rowOk) {
      for (const key of checkableKeys) {
        if (key.some((f) => data[f] === null || data[f] === undefined)) continue;
        const signature = `${key.join("+")}=${key.map((f) => JSON.stringify(data[f])).join("|")}`;
        const prev = firstSeen.get(signature);
        if (prev !== undefined) {
          const pairs = key.map((f) => `${f}=${display(data[f])}`).join(", ");
          issues.push({
            row: excelRow,
            column: key.join(", "),
            message: `Duplicate of row ${prev} — ${pairs} already appears above. ${key.join(" + ")} must be unique.`,
          });
          rowOk = false;
          break;
        }
        firstSeen.set(signature, excelRow);
      }
    }

    if (rowOk && Object.keys(data).length > 0) rows.push(data);
  }

  if (totalRows === 0) {
    issues.push({ row: null, column: null, message: "No data rows found below the header." });
  }

  return { headers, columns, rows, issues, totalRows };
}
