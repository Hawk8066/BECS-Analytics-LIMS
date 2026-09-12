// Payroll computation (D4). Amounts in PKR paisa.
//
// Salary income tax uses the FBR salaried-person slabs for Tax Year 2026-27,
// taken from docs/ISO_Documents/Tax calculator 26-27 (Salary, Rent, Business
// Income).xls. The slabs are ANNUAL and expressed in whole rupees; tax for a
// band = base + rate × (annual taxable − floor). Medical allowance is exempt up
// to 10% of basic and cash allowances are excluded from taxable pay.

export const SALARY_TAX_YEAR = "2026-27";

interface Slab {
  floor: number; // annual taxable income (rupees) must exceed this
  base: number; // fixed tax accumulated up to the floor
  rate: number; // marginal rate above the floor
}

const SALARY_SLABS: Slab[] = [
  { floor: 0, base: 0, rate: 0 },
  { floor: 600_000, base: 0, rate: 0.01 },
  { floor: 1_200_000, base: 6_000, rate: 0.11 },
  { floor: 2_200_000, base: 116_000, rate: 0.2 },
  { floor: 3_200_000, base: 316_000, rate: 0.25 },
  { floor: 4_100_000, base: 541_000, rate: 0.29 },
  { floor: 5_600_000, base: 976_000, rate: 0.32 },
  { floor: 7_000_000, base: 1_424_000, rate: 0.35 },
];

/** Annual salary income tax (rupees) for a given annual taxable income (rupees). */
export function annualSalaryTaxRupees(annualTaxableRupees: number): number {
  const x = Math.max(0, annualTaxableRupees);
  let band = SALARY_SLABS[0];
  for (const s of SALARY_SLABS) if (x > s.floor) band = s;
  return band.base + (x - band.floor) * band.rate;
}

/**
 * Monthly salary income tax (paisa) from the monthly taxable pay (paisa): the
 * taxable pay is annualised (× 12), taxed against the annual slabs, then spread
 * back over 12 months.
 */
export function computeIncomeTax(monthlyTaxablePaisa: number): number {
  const annualTaxableRupees = (monthlyTaxablePaisa * 12) / 100;
  const annualTaxRupees = annualSalaryTaxRupees(annualTaxableRupees);
  return Math.round((annualTaxRupees * 100) / 12); // paisa
}

export interface SalaryInput {
  basic: number;
  houseRent: number;
  conveyance: number;
  medical: number;
  otherAllowances: number;
  cashAllowance: number; // allowance paid in cash — not taxable
  providentFundPct: number;
  eobi: number;
}

export function computePayrollItem(s: SalaryInput) {
  // Medical allowance is exempt up to 10% of basic; the excess is taxable.
  const medicalExempt = Math.min(s.medical, Math.round(s.basic * 0.1));
  const taxableMedical = Math.max(0, s.medical - medicalExempt);

  // Taxable pay excludes the exempt medical portion and the cash allowance.
  const taxable =
    s.basic + s.houseRent + s.conveyance + s.otherAllowances + taxableMedical;

  // Gross pay includes everything actually paid, cash allowance included.
  const gross =
    s.basic +
    s.houseRent +
    s.conveyance +
    s.medical +
    s.otherAllowances +
    s.cashAllowance;

  const incomeTax = computeIncomeTax(taxable);
  const providentFund = Math.round((s.basic * s.providentFundPct) / 100);
  const eobi = s.eobi;
  const advances = 0;
  const netPay = gross - providentFund - incomeTax - eobi - advances;

  return {
    gross,
    taxable,
    medicalExempt,
    cashAllowance: s.cashAllowance,
    providentFund,
    incomeTax,
    eobi,
    advances,
    netPay,
  };
}
