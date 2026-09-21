import { describe, it, expect } from "vitest";
import { planLotImport, LOT_COLUMNS, type LotProduct } from "@/lib/qc/lot-import";
import { judge } from "@/lib/qc/spec";

/**
 * Bulk QC-lot import.
 *
 * The rules that matter are: a product is named, not id'd; PASS/FAIL comes from
 * the product's spec rather than the sheet; and a bad row is reported without
 * taking the rest of the file down with it.
 */

const PRODUCTS: LotProduct[] = [
  { id: "p-raw", name: "Raw Zinc", specMin: 28, specMax: 32 },
  { id: "p-aom", name: "AOM", specMin: null, specMax: null },
];

const HEADER = LOT_COLUMNS.map((c) => c.label);
const row = (cells: Record<string, string>) =>
  LOT_COLUMNS.map((c) => cells[c.label] ?? "");

describe("verdicts come from the product spec", () => {
  it("passes a value inside the limits and fails one outside", () => {
    expect(judge(30, 28, 32)).toBe("PASS");
    expect(judge(27.9, 28, 32)).toBe("FAIL");
    expect(judge(32.1, 28, 32)).toBe("FAIL");
  });

  it("returns no verdict when the product has no spec", () => {
    // Recorded but not judged — silently passing an unjudgeable lot is worse.
    expect(judge(30, null, null)).toBeNull();
  });

  it("applies that to imported rows, ignoring any sheet opinion", () => {
    const plan = planLotImport(
      [
        HEADER,
        row({ Product: "Raw Zinc", "Vehicle / Batch No": "TRK-1", Result: "27" }),
        row({ Product: "AOM", "Vehicle / Batch No": "B-1", Result: "27" }),
      ],
      PRODUCTS,
    );
    expect(plan.issues).toEqual([]);
    expect(plan.rows[0].verdict).toBe("FAIL"); // 27 < specMin 28
    expect(plan.rows[1].verdict).toBeNull(); // AOM has no spec
  });
});

describe("resolving the product by name", () => {
  it("matches case- and spacing-insensitively", () => {
    const plan = planLotImport(
      [HEADER, row({ Product: "  raw   zinc ", "Vehicle / Batch No": "TRK-1" })],
      PRODUCTS,
    );
    expect(plan.issues).toEqual([]);
    expect(plan.rows[0].productTypeId).toBe("p-raw");
  });

  it("names the unknown product and points at Settings", () => {
    const plan = planLotImport(
      [HEADER, row({ Product: "Zabardast Urea", "Vehicle / Batch No": "B-9" })],
      PRODUCTS,
    );
    expect(plan.rows).toEqual([]);
    expect(plan.issues[0].message).toContain("Zabardast Urea");
    expect(plan.issues[0].row).toBe(2); // 1-based, as Excel shows it
  });
});

describe("a bad row does not take the file down", () => {
  it("imports the good rows and reports each problem separately", () => {
    const plan = planLotImport(
      [
        HEADER,
        row({ Product: "Raw Zinc", "Vehicle / Batch No": "TRK-1", Result: "30" }),
        row({ Product: "Nope", "Vehicle / Batch No": "TRK-2" }),
        row({ Product: "Raw Zinc", "Vehicle / Batch No": "" }),
        row({ Product: "Raw Zinc", "Vehicle / Batch No": "TRK-4", Result: "abc" }),
        row({ Product: "AOM", "Vehicle / Batch No": "B-5" }),
      ],
      PRODUCTS,
    );
    expect(plan.totalRows).toBe(5);
    expect(plan.rows).toHaveLength(2);
    expect(plan.issues).toHaveLength(3);
    expect(plan.issues.map((i) => i.row)).toEqual([3, 4, 5]);
  });

  it("ignores blank padding rows rather than calling them errors", () => {
    const plan = planLotImport(
      [HEADER, row({ Product: "AOM", "Vehicle / Batch No": "B-1" }), [], ["", "", ""]],
      PRODUCTS,
    );
    expect(plan.totalRows).toBe(1);
    expect(plan.issues).toEqual([]);
  });
});

describe("status follows whether a result was supplied", () => {
  it("marks a lot with a result APPROVED, and one without BOOKED", () => {
    // Only APPROVED lots with an approvedAt are picked up by the monthly
    // invoice, so this is what decides whether imported work is billable.
    const plan = planLotImport(
      [
        HEADER,
        row({ Product: "AOM", "Vehicle / Batch No": "B-1", Result: "12" }),
        row({ Product: "AOM", "Vehicle / Batch No": "B-2" }),
      ],
      PRODUCTS,
    );
    expect(plan.rows[0].status).toBe("APPROVED");
    expect(plan.rows[1].status).toBe("BOOKED");
    expect(plan.rows[1].resultValue).toBeNull();
  });
});

describe("header validation", () => {
  it("refuses the whole file when a required column is missing", () => {
    const plan = planLotImport([["Product", "Result"], ["Raw Zinc", "30"]], PRODUCTS);
    expect(plan.rows).toEqual([]);
    expect(plan.issues[0].message).toContain("Vehicle / Batch No");
  });

  it("reports an empty sheet rather than throwing", () => {
    expect(planLotImport([], PRODUCTS).issues[0].message).toContain("empty");
  });
});

describe("the downloadable template round-trips", () => {
  it("is a real .xlsx the importer can read back and accept", async () => {
    // The template is useless if the writer and reader disagree about the
    // format. Writing it, reading it and planning it proves the whole loop
    // without needing Excel.
    const { writeWorkbook } = await import("@/lib/xlsx/write");
    const { readWorkbook } = await import("@/lib/xlsx/read");
    const { lotTemplateRows } = await import("@/lib/qc/lot-import");

    const buf = writeWorkbook([
      { name: "QC lots", rows: lotTemplateRows("Raw Zinc") },
    ]);
    const sheets = readWorkbook(buf);
    expect(sheets).toHaveLength(1);

    const plan = planLotImport(sheets[0].rows, PRODUCTS);
    expect(plan.issues).toEqual([]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].productTypeId).toBe("p-raw");
    expect(plan.rows[0].refNo).toBe("TRK-1043");
    // 28.4 sits inside Raw Zinc's 28–32 spec.
    expect(plan.rows[0].verdict).toBe("PASS");
    expect(plan.rows[0].producedOn?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});
