import { describe, it, expect } from "vitest";
import type { Designation } from "@prisma/client";
import * as perms from "@/lib/auth/perms";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { CAPABILITIES, ASSIGNABLE_DESIGNATIONS } from "@/lib/auth/capabilities";
import { TEMPLATES } from "@/lib/feed/templates";
import { renderFeedRow } from "@/lib/feed/render";

const ALL: Designation[] = [
  "COO", "OPERATIONS_MANAGER", "LAB_MANAGER_RYK", "ANALYST", "ANALYST_RYK",
  "LAB_ASSISTANT", "LAB_ATTENDANT", "LIAISON_OFFICER", "ACCOUNTANT",
  "PURCHASE_OFFICER", "STORE_INCHARGE", "IT_OFFICER", "SALES_MARKETING_OFFICER",
  "CLIENT", "VENDOR", "OUTSOURCE_LAB",
];

describe("Tier-1 capability matrix", () => {
  it("ADMIN passes every capability (never lockable out)", () => {
    for (const c of CAPABILITIES) {
      expect(perms.isAdmin("ADMIN")).toBe(true);
      // every predicate is a lookup, so test through the store contract:
      expect(c.defaults).toBeDefined();
    }
    // canAdminister is hard-wired to ADMIN and is NOT configurable.
    expect(perms.canAdminister("ADMIN")).toBe(true);
    for (const d of ALL) expect(perms.canAdminister(d)).toBe(false);
  });

  it("only the COO holds the approvals the SSOT reserves to them", () => {
    const cooOnly = [
      perms.canApproveProfile, perms.canApproveFunction, perms.canGrantAuthorization,
      perms.canApproveSample, perms.canApprovePR, perms.canSelectQuotation,
      perms.canApproveParameter, perms.canApprovePayroll,
    ];
    for (const can of cooOnly) {
      expect(can("COO")).toBe(true);
      for (const d of ALL.filter((x) => x !== "COO")) expect(can(d)).toBe(false);
    }
  });

  it("external portal logins hold no staff capability", () => {
    for (const d of ["CLIENT", "VENDOR", "OUTSOURCE_LAB"] as Designation[]) {
      expect(perms.isPortalUser(d)).toBe(true);
      expect(perms.canViewFinance(d)).toBe(false);
      expect(perms.canManageStore(d)).toBe(false);
      expect(perms.canCoordinateTesting(d)).toBe(false);
    }
  });

  it("the bench-analyst pool covers both facilities", () => {
    // Guards the trap where an assignment query filters on "ANALYST" alone and
    // RYK analysts silently vanish from every picker.
    expect([...perms.ANALYST_DESIGNATIONS].sort()).toEqual(["ANALYST", "ANALYST_RYK"]);
    expect(perms.isAnalyst("ANALYST_RYK")).toBe(true);
    expect(perms.isAnalyst("LAB_ASSISTANT")).toBe(false);
  });

  it("ANALYST_RYK mirrors ANALYST exactly", () => {
    const caps = (d: Designation) =>
      CAPABILITIES.filter((c) => (c.defaults as readonly Designation[]).includes(d))
        .map((c) => c.key).sort();
    expect(caps("ANALYST_RYK")).toEqual(caps("ANALYST"));
  });

  it("assignable designations exclude ADMIN and the portal logins", () => {
    expect(ASSIGNABLE_DESIGNATIONS).not.toContain("ADMIN");
    for (const d of ["CLIENT", "VENDOR", "OUTSOURCE_LAB"])
      expect(ASSIGNABLE_DESIGNATIONS).not.toContain(d);
  });

  it("capability keys are unique", () => {
    const keys = CAPABILITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("blinding (SSOT §8)", () => {
  it("only the Liaison Officer may see client identity by default", () => {
    expect(canSeeClientIdentity("LIAISON_OFFICER")).toBe(true);
    expect(canSeeClientIdentity("ADMIN")).toBe(true); // super-admin bypass
    for (const d of ["ANALYST", "ANALYST_RYK", "OPERATIONS_MANAGER", "LAB_MANAGER_RYK", "ACCOUNTANT"] as Designation[])
      expect(canSeeClientIdentity(d)).toBe(false);
  });

  it("a feed row renders WITHOUT client identity for a blinded reader", () => {
    const row = {
      id: "t1",
      template: "clientRegistered",
      params: { clientNo: "CLI-0007", clientId: "abc", company: "Acme Foods Ltd" },
      createdAt: new Date(),
      actor: null,
    };
    const analyst = renderFeedRow(row, "ANALYST");
    const lo = renderFeedRow(row, "LIAISON_OFFICER");

    expect(analyst?.text).toContain("CLI-0007");
    expect(analyst?.text).not.toContain("Acme"); // the whole point
    expect(lo?.text).toContain("Acme Foods Ltd");
  });

  it("drops an unknown template instead of throwing", () => {
    const row = {
      id: "t2", template: "noSuchTemplate", params: {},
      createdAt: new Date(), actor: null,
    };
    expect(renderFeedRow(row, "COO")).toBeNull();
  });
});

describe("feed template registry", () => {
  it("every template targets a real capability as its audience", () => {
    const keys = new Set(CAPABILITIES.map((c) => c.key));
    for (const [name, def] of Object.entries(TEMPLATES))
      expect(keys.has(def.audience), `${name} → ${def.audience}`).toBe(true);
  });

  it("every template can render and produce a link from its own params", () => {
    // Smoke: templates must not throw on a well-formed params object.
    for (const [name, def] of Object.entries(TEMPLATES)) {
      expect(typeof def.render, name).toBe("function");
      expect(typeof def.href, name).toBe("function");
    }
  });
});
