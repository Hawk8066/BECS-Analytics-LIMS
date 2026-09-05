import { describe, it, expect } from "vitest";
import {
  annualSalaryTaxRupees,
  computeIncomeTax,
  computePayrollItem,
} from "@/lib/finance/payroll";

/**
 * FBR salaried-person slabs, Tax Year 2026-27, transcribed from
 * docs/ISO_Documents/Tax calculator 26-27 (Salary, Rent, Business Income).xls.
 * These assertions are the guard: if a future tax year is wired in without
 * updating the slabs deliberately, these fail loudly.
 */
describe("salary income tax — FBR slabs (TY 2026-27)", () => {
  it("charges nothing up to the exemption threshold", () => {
    expect(annualSalaryTaxRupees(0)).toBe(0);
    expect(annualSalaryTaxRupees(600_000)).toBe(0);
  });

  it.each([
    // [annual taxable, expected annual tax] — one per band, at its ceiling
    [1_200_000, 6_000], //  1% of 600k
    [2_200_000, 116_000], //  6,000 + 11% of 1,000,000
    [3_200_000, 316_000], //  116,000 + 20% of 1,000,000
    [4_100_000, 541_000], //  316,000 + 25% of 900,000
    [5_600_000, 976_000], //  541,000 + 29% of 1,500,000
    [7_000_000, 1_424_000], //  976,000 + 32% of 1,400,000
  ])("band ceiling %i → %i", (taxable, expected) => {
    expect(annualSalaryTaxRupees(taxable)).toBe(expected);
  });

  it("each band's fixed base equals the tax at the band below (no discontinuity)", () => {
    for (const floor of [600_000, 1_200_000, 2_200_000, 3_200_000, 4_100_000, 5_600_000, 7_000_000]) {
      const justBelow = annualSalaryTaxRupees(floor - 1);
      const atFloor = annualSalaryTaxRupees(floor);
      expect(Math.abs(atFloor - justBelow)).toBeLessThan(1); // continuous
    }
  });

  it("matches the worked example in the source spreadsheet", () => {
    // 300,000/month → 3,600,000/yr sits in the 25% band: 316,000 + 25% × 400,000
    expect(annualSalaryTaxRupees(3_600_000)).toBe(416_000);
  });

  it("applies the top marginal rate above the last floor", () => {
    expect(annualSalaryTaxRupees(8_000_000)).toBe(1_424_000 + 0.35 * 1_000_000);
  });

  it("never returns negative tax for junk input", () => {
    expect(annualSalaryTaxRupees(-5_000)).toBe(0);
  });

  it("annualises monthly taxable pay and spreads the tax back (paisa)", () => {
    // 300,000 PKR/month = 30,000,000 paisa → 416,000/yr → 34,666.67/month
    expect(computeIncomeTax(30_000_000)).toBe(Math.round((416_000 * 100) / 12));
  });
});

describe("payroll computation", () => {
  const base = {
    basic: 10_000_000, // PKR 100,000
    houseRent: 4_000_000,
    conveyance: 0,
    medical: 0,
    otherAllowances: 0,
    cashAllowance: 0,
    providentFundPct: 0,
    eobi: 0,
  };

  it("excludes the non-taxable cash allowance from tax but includes it in gross", () => {
    const without = computePayrollItem(base);
    const withCash = computePayrollItem({ ...base, cashAllowance: 1_500_000 });

    expect(withCash.gross).toBe(without.gross + 1_500_000);
    expect(withCash.taxable).toBe(without.taxable); // untouched
    expect(withCash.incomeTax).toBe(without.incomeTax); // so tax is unchanged
    expect(withCash.netPay).toBe(without.netPay + 1_500_000); // paid in full
  });

  it("exempts medical up to 10% of basic and taxes only the excess", () => {
    const exact = computePayrollItem({ ...base, medical: 1_000_000 }); // exactly 10%
    expect(exact.medicalExempt).toBe(1_000_000);
    expect(exact.taxable).toBe(base.basic + base.houseRent);

    const over = computePayrollItem({ ...base, medical: 1_500_000 }); // 15%
    expect(over.medicalExempt).toBe(1_000_000);
    expect(over.taxable).toBe(base.basic + base.houseRent + 500_000);
  });

  it("net pay equals gross less every deduction", () => {
    const c = computePayrollItem({ ...base, providentFundPct: 10, eobi: 37_000 });
    expect(c.netPay).toBe(
      c.gross - c.providentFund - c.incomeTax - c.eobi - c.advances,
    );
    expect(c.providentFund).toBe(base.basic * 0.1);
  });

  it("produces no tax for a salary under the exemption threshold", () => {
    const c = computePayrollItem({ ...base, basic: 4_000_000, houseRent: 0 });
    expect(c.incomeTax).toBe(0);
    expect(c.netPay).toBe(c.gross);
  });
});
