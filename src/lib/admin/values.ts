import type { AdminField } from "./registry";

// Value helpers shared by the admin pages (display) and server actions (coercion).
// Kept free of server-only imports so display helpers are safe to reuse anywhere.

/** Recursively convert a Prisma row into a JSON-safe value (BigInt/Date/Buffer). */
export function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toPlain(v);
    }
    return out;
  }
  return value;
}

/** Human-readable single-line string for a cell or form input default. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Value to pre-fill a datetime-local input (YYYY-MM-DDTHH:mm). */
export function toDatetimeLocal(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export class CoerceError extends Error {}

/**
 * Convert a raw FormData string into the typed value Prisma expects for `field`.
 * Returns `undefined` to mean "omit this field from the write".
 */
export function coerce(field: AdminField, raw: string | null): unknown {
  const empty = raw === null || raw === "";

  switch (field.type) {
    case "boolean":
      // Checkboxes submit "on"/"true" when checked, nothing when unchecked.
      return raw === "on" || raw === "true";

    case "int": {
      if (empty) return field.isRequired ? throwReq(field) : null;
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new CoerceError(`${field.name} must be an integer.`);
      return n;
    }
    case "float": {
      if (empty) return field.isRequired ? throwReq(field) : null;
      const n = Number(raw);
      if (Number.isNaN(n)) throw new CoerceError(`${field.name} must be a number.`);
      return n;
    }
    case "bigint": {
      if (empty) return field.isRequired ? throwReq(field) : null;
      try {
        return BigInt(raw as string);
      } catch {
        throw new CoerceError(`${field.name} must be a whole number.`);
      }
    }
    case "datetime": {
      if (empty) return field.isRequired ? throwReq(field) : null;
      const d = new Date(raw as string);
      if (Number.isNaN(d.getTime())) throw new CoerceError(`${field.name} is not a valid date.`);
      return d;
    }
    case "json": {
      if (empty) return field.isRequired ? throwReq(field) : null;
      try {
        return JSON.parse(raw as string);
      } catch {
        throw new CoerceError(`${field.name} must be valid JSON.`);
      }
    }
    case "enum":
      if (empty) return field.isRequired ? throwReq(field) : null;
      return raw;

    case "string":
      if (empty) return field.isRequired ? "" : null;
      return raw;

    default:
      return undefined; // unsupported types are never written
  }
}

function throwReq(field: AdminField): never {
  throw new CoerceError(`${field.name} is required.`);
}
