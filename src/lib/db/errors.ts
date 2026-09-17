import { Prisma } from "@prisma/client";

export interface UniqueViolation {
  /** The form field that collided, so the input can be marked invalid. */
  field: string | null;
  message: string;
}

/**
 * Friendly wording for a unique-constraint violation (Prisma P2002), or null if
 * the error is something else.
 *
 * A duplicate CNIC or email is a data-entry mistake, not an exceptional
 * condition. Left unhandled it escapes a server action and lands in the error
 * boundary, which tells the user nothing and looks like the app is broken — the
 * failure that produced digest 3288131712 in production.
 *
 * Returning null for everything else is deliberate: real faults must keep
 * propagating rather than being flattened into a form message.
 */
export function uniqueViolation(e: unknown): UniqueViolation | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002")
    return null;

  const target = e.meta?.target;
  const fields = Array.isArray(target)
    ? (target as string[])
    : typeof target === "string"
      ? [target]
      : [];

  // Known single-column constraints get wording that says what to do next, not
  // just what failed. Guarded on length: a composite key such as Parameter's
  // (name, matrix) contains "name" too, and blaming that one column would be
  // wrong — it is the combination that is taken, not the name on its own.
  if (fields.length === 1) {
    if (fields[0] === "cnic")
      return {
        field: "cnic",
        message:
          "That CNIC is already recorded against another person. Check the number, " +
          "or search Personnel for the existing record.",
      };
    if (fields[0] === "email")
      return { field: "email", message: "That email address is already registered." };
    if (fields[0] === "code")
      return { field: "code", message: "That code is already in use." };
    if (fields[0] === "name")
      return { field: "name", message: "That name is already in use." };
  }

  return {
    // A composite key (e.g. Parameter name+matrix) has no single field to blame,
    // so highlight nothing and let the message carry it.
    field: fields.length === 1 ? fields[0] : null,
    message: fields.length
      ? `Already in use by another record: ${fields.join(" + ")}.`
      : "That value is already in use by another record.",
  };
}
