import { Prisma } from "@prisma/client";

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
export function uniqueViolationMessage(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002")
    return null;

  const target = e.meta?.target;
  const fields = Array.isArray(target)
    ? (target as string[])
    : typeof target === "string"
      ? [target]
      : [];

  if (fields.includes("cnic"))
    return (
      "That CNIC is already recorded against another person. Check the number, " +
      "or search Personnel for the existing record."
    );
  if (fields.includes("email"))
    return "That email address is already registered.";

  return fields.length
    ? `Already in use by another record: ${fields.join(", ")}.`
    : "That value is already in use by another record.";
}
