import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { uniqueViolationMessage } from "@/lib/db/errors";

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
    const msg = uniqueViolationMessage(p2002(["cnic"]));
    expect(msg).toContain("CNIC");
    expect(msg).toContain("already");
  });

  it("handles a string target as well as an array", () => {
    // Prisma reports `target` inconsistently across connectors.
    expect(uniqueViolationMessage(p2002("cnic"))).toContain("CNIC");
  });

  it("names the email when that is what collided", () => {
    expect(uniqueViolationMessage(p2002(["email"]))).toContain("email");
  });

  it("still says something useful for an unknown unique field", () => {
    expect(uniqueViolationMessage(p2002(["invoiceNo"]))).toContain("invoiceNo");
  });

  it("copes with a missing target rather than throwing", () => {
    expect(uniqueViolationMessage(p2002(undefined))).toBeTruthy();
  });

  it("returns null for other Prisma errors, so they keep propagating", () => {
    const p2021 = new Prisma.PrismaClientKnownRequestError("no such table", {
      code: "P2021",
      clientVersion: "6.19.3",
    });
    expect(uniqueViolationMessage(p2021)).toBeNull();
  });

  it("returns null for a plain Error", () => {
    expect(uniqueViolationMessage(new Error("boom"))).toBeNull();
    expect(uniqueViolationMessage(undefined)).toBeNull();
  });
});
