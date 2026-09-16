import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { uniqueViolation } from "@/lib/db/errors";

/**
 * Regression guard for the production failure with digest 3288131712: saving a
 * personnel profile whose CNIC already belonged to someone else threw P2002 out
 * of a server action and rendered the error boundary, telling the user nothing.
 *
 * A duplicate is a data-entry mistake and must be reported in the form. Anything
 * that is NOT a unique violation must keep propagating, so real faults are never
 * silently flattened into a form message.
 */
const p2002 = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { modelName: "PersonnelProfile", target },
  });

describe("uniqueViolationMessage", () => {
  it("names the CNIC and points at the existing record", () => {
    const v = uniqueViolation(p2002(["cnic"]));
    expect(v!.message).toContain("CNIC");
    expect(v!.message).toContain("already");
  });

  it("reports WHICH field collided, so the input can be marked invalid", () => {
    // Without this the form can only print a message at the bottom; the user is
    // left to work out which of twelve inputs is at fault.
    expect(uniqueViolation(p2002(["cnic"]))!.field).toBe("cnic");
    expect(uniqueViolation(p2002(["email"]))!.field).toBe("email");
  });

  it("blames no single field for a composite key", () => {
    // Parameter is unique on (name, matrix) — highlighting just one would lie.
    const v = uniqueViolation(p2002(["name", "matrix"]));
    expect(v!.field).toBeNull();
    expect(v!.message).toContain("name");
    expect(v!.message).toContain("matrix");
  });

  it("handles a string target as well as an array", () => {
    // Prisma reports `target` inconsistently across connectors.
    expect(uniqueViolation(p2002("cnic"))!.message).toContain("CNIC");
  });

  it("names the email when that is what collided", () => {
    expect(uniqueViolation(p2002(["email"]))!.message).toContain("email");
  });

  it("still says something useful for an unknown unique field", () => {
    expect(uniqueViolation(p2002(["invoiceNo"]))!.message).toContain("invoiceNo");
  });

  it("copes with a missing target rather than throwing", () => {
    expect(uniqueViolation(p2002(undefined))!.message).toBeTruthy();
  });

  it("returns null for other Prisma errors, so they keep propagating", () => {
    const p2021 = new Prisma.PrismaClientKnownRequestError("no such table", {
      code: "P2021",
      clientVersion: "6.19.3",
    });
    expect(uniqueViolation(p2021)).toBeNull();
  });

  it("returns null for a plain Error", () => {
    expect(uniqueViolation(new Error("boom"))).toBeNull();
    expect(uniqueViolation(undefined)).toBeNull();
  });
});
