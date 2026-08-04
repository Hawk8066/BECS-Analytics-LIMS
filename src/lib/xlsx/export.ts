import "server-only";

/**
 * Turn a model's rows into sheet data, using the same DMMF registry the
 * importer matches columns against — so an exported file is a valid import
 * file, and a blank template lists exactly the columns the importer expects.
 */
import { delegateFor, type AdminField, type AdminModel } from "@/lib/admin/registry";
import { isPaisaField, paisaToRupees } from "@/lib/money";
import type { CellValue, SheetData } from "./write";

/** Hard ceiling on rows per export, to keep a request in memory-safe territory. */
export const MAX_EXPORT_ROWS = 20_000;

/**
 * Columns to write.
 *  - "importable": editable fields only — the file can be re-imported as-is.
 *  - "all": every scalar field, id first, including server-managed ones.
 */
export type ExportScope = "importable" | "all";

export function exportFields(model: AdminModel, scope: ExportScope): AdminField[] {
  if (scope === "importable") return model.fields.filter((f) => f.editable);
  const scalars = model.fields.filter((f) => !f.isList && f.type !== "unsupported");
  const id = scalars.filter((f) => f.isId);
  return [...id, ...scalars.filter((f) => !f.isId)];
}

/** Prisma value -> cell, typed so numbers stay numbers and dates round-trip. */
function toCell(model: AdminModel, field: AdminField, value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  // Money is stored in paisa and written/read as rupees, so the file a user
  // exports, edits and uploads again comes back to the same amount.
  if (isPaisaField(model.name, field.name)) return paisaToRupees(value);
  switch (field.type) {
    case "int":
    case "float":
      return typeof value === "number" ? value : Number(value);
    case "bigint":
      return String(value);
    case "boolean":
      return Boolean(value);
    case "datetime":
      return value instanceof Date ? value.toISOString() : String(value);
    case "json":
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/**
 * Header-only workbook: exactly the columns an operator needs to fill in.
 * Server-stamped fields are left out so the template agrees with the column
 * hints shown next to the upload control.
 */
export function templateSheet(model: AdminModel, autoFilled: Set<string>): SheetData {
  const headers = exportFields(model, "importable")
    .filter((f) => !autoFilled.has(f.name))
    .map((f) => f.name);
  return { name: model.name, rows: [headers] };
}

export async function exportSheet(
  model: AdminModel,
  scope: ExportScope,
): Promise<SheetData> {
  const fields = exportFields(model, scope);
  // `select` keeps relations out and avoids pulling columns we won't write.
  const select = Object.fromEntries(fields.map((f) => [f.name, true]));

  const rows: Record<string, unknown>[] = await delegateFor(model).findMany({
    select,
    take: MAX_EXPORT_ROWS,
    ...(model.idField ? { orderBy: { [model.idField]: "asc" } } : {}),
  });

  return {
    name: model.name,
    rows: [
      fields.map((f) => f.name),
      ...rows.map((r) => fields.map((f) => toCell(model, f, r[f.name]))),
    ],
  };
}
