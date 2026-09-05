import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EXPENSE_GROUPS, type ExpenseGroupKey } from "@/lib/finance/accounts";

/**
 * The company's money in the four shapes the finance pages report it: what
 * testing earned, what we owe vendors, what we owe external labs, and what it
 * all cost. Computed once here so the dashboard and the statements page can
 * never disagree.
 *
 * Balances come from the general ledger (the authority on totals); the per-party
 * payable lists come from the bill tables, because Accounts Payable is a single
 * account and can't say who is owed what. The two always reconcile: every bill
 * posts to 2000 and every payment reverses it.
 *
 * Figures are company-wide (both facilities) and in PKR paisa.
 */

// Normal-balance convention: ASSET/EXPENSE are debit-normal, the rest credit-normal.
function balance(type: AccountType, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE" ? debit - credit : credit - debit;
}

export type PartyPayable = {
  id: string;
  name: string;
  billed: number;
  paid: number;
  outstanding: number;
  openBills: number;
};

/**
 * Billed / paid / outstanding for one party's documents — vendor bills,
 * outsource-lab bills, or client invoices. Each doc carries its gross `amount`
 * and its own `payments`; payments have no direct counterparty FK, so "paid" is
 * always summed from the documents here. Used by the per-counterparty detail
 * and list views.
 */
export function docBalance(
  docs: { amount: number; payments: { amount: number }[] }[],
): { billed: number; paid: number; outstanding: number; openDocs: number } {
  let billed = 0;
  let paid = 0;
  let openDocs = 0;
  for (const d of docs) {
    const p = d.payments.reduce((s, x) => s + x.amount, 0);
    billed += d.amount;
    paid += p;
    if (d.amount - p > 0) openDocs += 1;
  }
  return { billed, paid, outstanding: billed - paid, openDocs };
}

export type FinanceSummary = {
  income: {
    /** Testing revenue net of sales tax (GL 4000). */
    net: number;
    /** Sales tax charged on invoices and owed to the FBR (GL 2100). */
    tax: number;
    /** Billed to clients, tax-inclusive — everything debited to receivables. */
    invoiced: number;
    /** Collected — everything credited back off receivables. */
    received: number;
    /** Receivables still open (GL 1100 balance). */
    outstanding: number;
    /**
     * What the Invoice table itself holds. The ledger is append-only, so an
     * invoice deleted after posting leaves its entry behind and this total falls
     * short of `invoiced`; the statements page reports the gap rather than
     * silently showing two different revenue figures.
     */
    records: { count: number; total: number };
  };
  vendors: {
    rows: PartyPayable[];
    billed: number;
    paid: number;
    outstanding: number;
  };
  labs: {
    rows: PartyPayable[];
    billed: number;
    paid: number;
    outstanding: number;
  };
  expenses: {
    byGroup: Record<ExpenseGroupKey, number>;
    total: number;
  };
  netIncome: number;
};

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const [accounts, grouped, invoiceAgg, vendorBills, labBills] =
    await Promise.all([
      prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } }),
      prisma.journalLine.groupBy({
        by: ["accountId"],
        _sum: { debit: true, credit: true },
      }),
      prisma.invoice.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
      prisma.vendorBill.findMany({
        include: {
          vendor: { select: { id: true, company: true } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.outsourceBill.findMany({
        include: {
          outsourceLab: { select: { id: true, name: true } },
          payments: { select: { amount: true } },
        },
      }),
    ]);

  const sums = new Map(grouped.map((g) => [g.accountId, g._sum]));
  const sidesOf = (code: string): { debit: number; credit: number } => {
    const account = accounts.find((a) => a.code === code);
    const s = account ? sums.get(account.id) : undefined;
    return { debit: s?.debit ?? 0, credit: s?.credit ?? 0 };
  };
  const balanceOf = (code: string): number => {
    const account = accounts.find((a) => a.code === code);
    if (!account) return 0;
    const { debit, credit } = sidesOf(code);
    return balance(account.type, debit, credit);
  };

  // --- Income from testing ---------------------------------------------------
  // Receivables carry the whole client story: invoices debit 1100, payments
  // credit it, so the account's two sides are "billed" and "collected" and its
  // balance is what clients still owe.
  const receivable = sidesOf("1100");
  const netRevenue = balanceOf("4000");

  // --- Payables, per party ---------------------------------------------------
  const roll = <T,>(
    bills: T[],
    party: (b: T) => { id: string; name: string },
    amountOf: (b: T) => number,
    paidOf: (b: T) => number,
  ): { rows: PartyPayable[]; billed: number; paid: number; outstanding: number } => {
    const by = new Map<string, PartyPayable>();
    for (const b of bills) {
      const { id, name } = party(b);
      const row = by.get(id) ?? {
        id,
        name,
        billed: 0,
        paid: 0,
        outstanding: 0,
        openBills: 0,
      };
      const amount = amountOf(b);
      const paid = paidOf(b);
      row.billed += amount;
      row.paid += paid;
      row.outstanding += amount - paid;
      if (amount - paid > 0) row.openBills += 1;
      by.set(id, row);
    }
    const rows = [...by.values()].sort((a, b) => b.outstanding - a.outstanding);
    return {
      rows,
      billed: rows.reduce((s, r) => s + r.billed, 0),
      paid: rows.reduce((s, r) => s + r.paid, 0),
      outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    };
  };

  const sumPayments = (ps: { amount: number }[]) => ps.reduce((s, p) => s + p.amount, 0);
  const vendors = roll(
    vendorBills,
    (b) => ({ id: b.vendor.id, name: b.vendor.company }),
    (b) => b.amount,
    (b) => sumPayments(b.payments),
  );
  const labs = roll(
    labBills,
    (b) => ({ id: b.outsourceLab.id, name: b.outsourceLab.name }),
    (b) => b.amount,
    (b) => sumPayments(b.payments),
  );

  // --- Expenses, grouped the way the statements page reports them -------------
  const byGroup = Object.fromEntries(
    Object.entries(EXPENSE_GROUPS).map(([key, codes]) => [
      key,
      codes.reduce((s, code) => s + balanceOf(code), 0),
    ]),
  ) as Record<ExpenseGroupKey, number>;
  // Any EXPENSE account not listed in a group would otherwise be invisible here,
  // so it is folded into the total and reported as unallocated by the caller.
  const groupedCodes = new Set<string>(Object.values(EXPENSE_GROUPS).flat());
  const totalExpenses = accounts
    .filter((a) => a.type === "EXPENSE")
    .reduce((s, a) => s + balanceOf(a.code), 0);
  const unallocated = accounts
    .filter((a) => a.type === "EXPENSE" && !groupedCodes.has(a.code))
    .reduce((s, a) => s + balanceOf(a.code), 0);
  if (unallocated !== 0) byGroup.utilitiesOther += unallocated;

  return {
    income: {
      net: netRevenue,
      tax: balanceOf("2100"),
      invoiced: receivable.debit,
      received: receivable.credit,
      outstanding: receivable.debit - receivable.credit,
      records: {
        count: invoiceAgg._count._all,
        total: invoiceAgg._sum.amount ?? 0,
      },
    },
    vendors,
    labs,
    expenses: { byGroup, total: totalExpenses },
    netIncome: netRevenue - totalExpenses,
  };
}
