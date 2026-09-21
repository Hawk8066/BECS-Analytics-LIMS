import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { uniqueViolation } from "@/lib/db/errors";
import { NEW_PARAMETER } from "@/lib/parameters/constants";
import { canAdminister } from "@/lib/auth/perms";
import type { Designation } from "@prisma/client";

/**
 * Admin-only creation of QC product types.
 *
 * Production came up with "No product types configured" and no way forward:
 * the seed never creates ProductType rows, and the only way to add one was the
 * generic admin table editor, which knows nothing about stages, lineage or
 * billing rates.
 */

describe("who may add product types", () => {
  it("is ADMIN alone — not the Lab Manager who runs the section", () => {
    expect(canAdminister("ADMIN")).toBe(true);
    // manageProductionQc holders. Defining a product line is setup, not QC work.
    for (const d of ["LAB_MANAGER_RYK", "OPERATIONS_MANAGER", "COO"] as Designation[])
      expect(canAdminister(d), d).toBe(false);
  });

  it("is not reassignable, unlike the other QC capabilities", () => {
    // canAdminister is hard-wired to the designation so the super-admin cannot
    // be locked out of their own controls — it is deliberately not a capability.
    for (const d of ["ANALYST", "ANALYST_RYK", "CLIENT"] as Designation[])
      expect(canAdminister(d)).toBe(false);
  });
});

describe("duplicate product name", () => {
  it("reports on the name field instead of throwing", () => {
    // ProductType is @@unique([facilityId, name]); a repeat is data entry.
    const e = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
      meta: { modelName: "ProductType", target: ["facilityId", "name"] },
    });
    const v = uniqueViolation(e);
    expect(v).not.toBeNull();
    // Composite key, so no single field is blamed — the message carries both.
    expect(v!.field).toBeNull();
    expect(v!.message).toContain("facilityId");
    expect(v!.message).toContain("name");
  });
});

describe("the new-parameter sentinel", () => {
  it("cannot collide with a real parameter id", () => {
    // Parameter ids are uuids; the sentinel is deliberately not uuid-shaped.
    expect(NEW_PARAMETER).toBe("__new__");
    expect(NEW_PARAMETER).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("is importable from a module with no server-only guard", async () => {
    // It is read by the server action AND the client form; putting it in the
    // server-only creation helper broke the build.
    const mod = await import("@/lib/parameters/constants");
    expect(mod.NEW_PARAMETER).toBe(NEW_PARAMETER);
  });
});
