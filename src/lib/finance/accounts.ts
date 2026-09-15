import type { AccountType, ExpenseCategory } from "@prisma/client";

/**
 * The canonical chart of accounts (ADR-0004). This list — not the seed script —
 * is the source of truth: `postJournal` creates any account it needs that the
 * database doesn't have yet, so adding a code here is all it takes to start
 * posting to it. Seeding uses the same list.
 */
export const ACCOUNTS: { code: string; name: string; type: AccountType }[] = [
  { code: "1000", name: "Cash", type: "ASSET" },
  { code: "1010", name: "Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1150", name: "Input Tax Recoverable", type: "ASSET" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2100", name: "Sales Tax Payable", type: "LIABILITY" },
  { code: "3000", name: "Owner's Equity", type: "EQUITY" },
  { code: "4000", name: "Sales Revenue", type: "REVENUE" },
  // 5000 predates the split below and is posted to by outsource-lab bills only,
  // so its whole balance is external-lab cost. New expense kinds get their own
  // code rather than being folded back into it.
  { code: "5000", name: "Operating Expenses", type: "EXPENSE" },
  { code: "5100", name: "Payroll Expense", type: "EXPENSE" },
  { code: "5200", name: "Utilities", type: "EXPENSE" },
  { code: "5300", name: "Purchases & Supplies", type: "EXPENSE" },
  { code: "5900", name: "Other Expenses", type: "EXPENSE" },
];

/**
 * Expense accounts grouped the way the statements page reports them. Every
 * EXPENSE account must appear in exactly one group, or its balance would vanish
 * from the breakdown while still counting toward the total.
 */
export const EXPENSE_GROUPS = {
  vendorPurchases: ["5300"],
  utilitiesOther: ["5200", "5900"],
  externalLabs: ["5000"],
  payroll: ["5100"],
} as const;

export type ExpenseGroupKey = keyof typeof EXPENSE_GROUPS;

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroupKey, string> = {
  vendorPurchases: "Vendor purchases",
  utilitiesOther: "Utilities & other payments",
  externalLabs: "External labs",
  payroll: "Payroll",
};

/** Which account a directly-paid running cost lands in. */
export function expenseAccountFor(category: ExpenseCategory): string {
  return category === "UTILITY" ? "5200" : "5900";
}

/** Cash vs bank settlement for an expense (`Expense.paidFrom`). */
export function sourceAccountFor(paidFrom: string): string {
  return paidFrom === "CASH" ? "1000" : "1010";
}
