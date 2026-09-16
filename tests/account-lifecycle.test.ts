import { describe, it, expect } from "vitest";
import type { Designation } from "@prisma/client";
import { canDeactivateUser } from "@/lib/auth/perms";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { isSensitiveField } from "@/lib/admin/registry";

/**
 * Account offboarding and the secrets the generic admin editor must not touch.
 *
 * NON_ACTIVE existed in the schema from the first migration but nothing ever
 * wrote it — it was reachable only by hand-editing the row in the generic admin
 * panel. BR-12 requires that a resigned person is retained rather than deleted,
 * and the foreign keys enforce it: PersonnelProfile, Signature, Attendance and
 * Authorization are all ON DELETE RESTRICT, so deletion would mean destroying
 * the ISO 17025 evidence behind that person's signed reports.
 */

const ALL: Designation[] = [
  "COO", "OPERATIONS_MANAGER", "LAB_MANAGER_RYK", "ANALYST", "ANALYST_RYK",
  "LAB_ASSISTANT", "LAB_ATTENDANT", "LIAISON_OFFICER", "ACCOUNTANT",
  "PURCHASE_OFFICER", "STORE_INCHARGE", "IT_OFFICER", "SALES_MARKETING_OFFICER",
  "CLIENT", "VENDOR", "OUTSOURCE_LAB",
];

describe("deactivating an account", () => {
  it("is reserved to the COO by default", () => {
    expect(canDeactivateUser("COO")).toBe(true);
    for (const d of ALL.filter((x) => x !== "COO"))
      expect(canDeactivateUser(d), d).toBe(false);
  });

  it("is available to ADMIN, who bypasses the matrix", () => {
    expect(canDeactivateUser("ADMIN")).toBe(true);
  });

  it("is reassignable from Admin > Roles, unlike canAdminister", () => {
    // Registered in the catalogue means the matrix screen can move it; hard-wired
    // predicates like canAdminister deliberately are not.
    const cap = CAPABILITIES.find((c) => c.key === "deactivateUser");
    expect(cap).toBeDefined();
    expect(cap!.group).toBe("Personnel");
  });

  it("no portal login can deactivate staff", () => {
    for (const d of ["CLIENT", "VENDOR", "OUTSOURCE_LAB"] as Designation[])
      expect(canDeactivateUser(d)).toBe(false);
  });
});

describe("secrets the generic admin editor must never expose", () => {
  it("treats User.passwordHash as sensitive", () => {
    // It is just an optional String in the DMMF, so without an explicit denylist
    // the editor rendered it as a text input pre-filled with the live Argon2
    // hash — editable, and copied verbatim into the immutable audit log.
    expect(isSensitiveField("User", "passwordHash")).toBe(true);
  });

  it("leaves ordinary fields alone", () => {
    expect(isSensitiveField("User", "email")).toBe(false);
    expect(isSensitiveField("User", "status")).toBe(false);
    expect(isSensitiveField("Client", "company")).toBe(false);
  });

  it("does not leak the denylist across models", () => {
    expect(isSensitiveField("Client", "passwordHash")).toBe(false);
  });
});
