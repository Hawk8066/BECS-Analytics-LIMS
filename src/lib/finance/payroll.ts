// Payroll computation (D4). Amounts in PKR paisa. The income-tax slab here is a
// simplified placeholder — exact FBR slabs are an open question (Module 06).
export function computeIncomeTax(monthlyGrossPaisa: number): number {
  const g = monthlyGrossPaisa / 100; // PKR
  let tax = 0;
  if (g > 100000) tax += (Math.min(g, 200000) - 100000) * 0.1;
  if (g > 200000) tax += (g - 200000) * 0.2;
  return Math.round(tax * 100); // paisa
}

export interface SalaryInput {
  basic: number;
  houseRent: number;
  conveyance: number;
  medical: number;
  otherAllowances: number;
  providentFundPct: number;
  eobi: number;
}

export function computePayrollItem(s: SalaryInput) {
  const gross =
    s.basic + s.houseRent + s.conveyance + s.medical + s.otherAllowances;
  const providentFund = Math.round((s.basic * s.providentFundPct) / 100);
  const incomeTax = computeIncomeTax(gross);
  const eobi = s.eobi;
  const advances = 0;
  const netPay = gross - providentFund - incomeTax - eobi - advances;
  return { gross, providentFund, incomeTax, eobi, advances, netPay };
}
