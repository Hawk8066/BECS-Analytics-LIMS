import { describe, it, expect } from "vitest";
import type { Designation } from "@prisma/client";
import { TEMPLATES } from "@/lib/feed/templates";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { canAccessProductionQc } from "@/lib/auth/perms";
import { hasCapability } from "@/lib/auth/capability-store";

/**
 * The Production QC section now mounts the feed, so its notifications are
 * readable without leaving for /app.
 *
 * That is only worth anything if the people who can open the page also hold the
 * capability the QC templates are addressed to. Narrowing either side would
 * leave a bell that is empty by construction — visible chrome, no content — and
 * nothing else would fail.
 */

const ALL: Designation[] = [
  "ADMIN", "COO", "OPERATIONS_MANAGER", "LAB_MANAGER_RYK", "ANALYST",
  "ANALYST_RYK", "LAB_ASSISTANT", "LAB_ATTENDANT", "LIAISON_OFFICER",
  "ACCOUNTANT", "PURCHASE_OFFICER", "STORE_INCHARGE", "IT_OFFICER",
  "SALES_MARKETING_OFFICER", "CLIENT", "VENDOR", "OUTSOURCE_LAB",
];

const qcTemplates = Object.entries(TEMPLATES).filter(
  ([, def]) => def.kind === "QC",
);

describe("QC feed reaches the people who work in QC", () => {
  it("has QC templates at all", () => {
    expect(qcTemplates.length).toBeGreaterThan(0);
  });

  it("addresses every one to a real capability", () => {
    const keys = new Set(CAPABILITIES.map((c) => c.key));
    for (const [name, def] of qcTemplates)
      expect(keys.has(def.audience), `${name} -> ${def.audience}`).toBe(true);
  });

  it("means anyone who can open /btf-qc can read its reel", () => {
    // The layout guard is canAccessProductionQc. If a QC template were
    // re-addressed to a narrower capability, those users would see an empty
    // reel with no error anywhere — this is what catches that.
    for (const d of ALL.filter((x) => canAccessProductionQc(x)))
      for (const [name, def] of qcTemplates)
        expect(hasCapability(def.audience, d), `${d} misses ${name}`).toBe(true);
  });

  it("does not leak QC activity to someone who cannot open the section", () => {
    for (const d of ALL.filter((x) => !canAccessProductionQc(x)))
      for (const [, def] of qcTemplates)
        expect(hasCapability(def.audience, d)).toBe(false);
  });

  it("links every QC notification into the QC section, not the staff app", () => {
    // A notification that bounced the reader to /app would defeat the point of
    // mounting the bell here.
    for (const [name, def] of qcTemplates) {
      const href = def.href({ lotId: "abc" } as never);
      expect(href, name).toContain("/btf-qc/");
    }
  });
});
