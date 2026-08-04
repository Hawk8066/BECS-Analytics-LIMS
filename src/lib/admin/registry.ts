import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Generic admin registry. Everything here is derived from Prisma's DMMF, so the
// Admin panel automatically covers every model in schema.prisma — no per-model
// maintenance. Used only by ADMIN (canAdminister) for view/edit/delete.
// ---------------------------------------------------------------------------

export type AdminFieldType =
  | "string"
  | "int"
  | "bigint"
  | "float"
  | "boolean"
  | "datetime"
  | "json"
  | "enum"
  | "unsupported";

export interface AdminField {
  name: string;
  type: AdminFieldType;
  isId: boolean;
  isRequired: boolean;
  isList: boolean;
  /** Has a schema-level default (so an empty value on create can be omitted). */
  hasDefault: boolean;
  /** Editable in the create/edit form (scalars/enums; not relations or auto fields). */
  editable: boolean;
  /** Auto-managed (id default, createdAt, @updatedAt) — shown read-only. */
  auto: boolean;
  enumValues?: string[];
}

export interface AdminModel {
  /** Model name as in schema (e.g. "User"). */
  name: string;
  /** Prisma client delegate key (e.g. "user", "gRN"). */
  delegate: string;
  /** Single-column primary key field name, or null for composite/none. */
  idField: string | null;
  fields: AdminField[];
  /** Field names shown as columns in the list view. */
  listColumns: string[];
  /**
   * Unique constraints as field-name tuples — single-column `@unique` and
   * composite `@@unique` alike. Used to catch duplicates within an import file
   * before the database rejects them.
   */
  uniqueKeys: string[][];
}

function scalarType(t: string): AdminFieldType {
  switch (t) {
    case "String":
      return "string";
    case "Boolean":
      return "boolean";
    case "Int":
      return "int";
    case "BigInt":
      return "bigint";
    case "Float":
    case "Decimal":
      return "float";
    case "DateTime":
      return "datetime";
    case "Json":
      return "json";
    default:
      return "unsupported";
  }
}

const enumValuesByName = new Map<string, string[]>(
  Prisma.dmmf.datamodel.enums.map((e) => [e.name, e.values.map((v) => v.name)]),
);

// Prefer these as list columns when present (after the id).
const PREFERRED_COLUMNS = [
  "name",
  "email",
  "code",
  "title",
  "fullName",
  "company",
  "labId",
  "status",
  "designation",
  "action",
  "entityType",
  "prNo",
  "poNo",
  "invoiceNo",
  "assetTag",
  "createdAt",
];

function buildModel(m: Prisma.DMMF.Model): AdminModel {
  const idField = m.fields.find((f) => f.isId)?.name ?? null;

  const fields: AdminField[] = m.fields
    .filter((f) => f.kind !== "object") // drop relation navigation fields
    .map((f) => {
      const type = f.kind === "enum" ? "enum" : scalarType(f.type);
      const auto =
        f.isId || f.isUpdatedAt || (f.name === "createdAt" && f.hasDefaultValue);
      const editable =
        !auto &&
        !f.isList &&
        type !== "unsupported" &&
        f.kind !== "object";
      return {
        name: f.name,
        type,
        isId: f.isId,
        isRequired: f.isRequired,
        isList: f.isList,
        hasDefault: f.hasDefaultValue,
        editable,
        auto,
        enumValues: f.kind === "enum" ? enumValuesByName.get(f.type) : undefined,
      };
    });

  // List columns: id first, then preferred names that exist, then fill to 6.
  const names = new Set(fields.filter((f) => !f.isList).map((f) => f.name));
  const cols: string[] = [];
  if (idField) cols.push(idField);
  for (const p of PREFERRED_COLUMNS) {
    if (names.has(p) && !cols.includes(p)) cols.push(p);
  }
  for (const f of fields) {
    if (cols.length >= 6) break;
    if (f.type === "json" || f.isList) continue;
    if (!cols.includes(f.name)) cols.push(f.name);
  }

  // Unique keys: composite @@unique tuples plus every single-column @unique.
  const uniqueKeys: string[][] = [...m.uniqueFields.map((k) => [...k])];
  for (const f of m.fields) {
    if (f.isUnique && !uniqueKeys.some((k) => k.length === 1 && k[0] === f.name)) {
      uniqueKeys.push([f.name]);
    }
  }

  return {
    name: m.name,
    delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
    idField,
    fields,
    listColumns: cols,
    uniqueKeys,
  };
}

const MODELS: AdminModel[] = Prisma.dmmf.datamodel.models
  .map(buildModel)
  .sort((a, b) => a.name.localeCompare(b.name));

const MODEL_BY_NAME = new Map(MODELS.map((m) => [m.name, m]));

export function listModels(): AdminModel[] {
  return MODELS;
}

export function getModel(name: string): AdminModel | undefined {
  return MODEL_BY_NAME.get(name);
}

/** The Prisma delegate (e.g. prisma.user) for a model, typed loosely for generic CRUD. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function delegateFor(model: AdminModel): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model.delegate];
}

export async function countAll(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    MODELS.map(async (m) => {
      try {
        const n: number = await delegateFor(m).count();
        return [m.name, n] as const;
      } catch {
        return [m.name, -1] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
