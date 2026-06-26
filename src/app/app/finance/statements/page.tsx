import { redirect } from "next/navigation";
import type { AccountType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canViewFinance } from "@/lib/auth/perms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function pkr(paisa: number): string {
  return (paisa / 100).toLocaleString("en-PK", { minimumFractionDigits: 2 });
}

// Normal-balance convention: ASSET/EXPENSE are debit-normal; the rest credit-normal.
function balance(type: AccountType, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE"
    ? debit - credit
    : credit - debit;
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1 text-sm ${bold ? "font-semibold" : ""}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>PKR {pkr(value)}</span>
    </div>
  );
}

export default async function StatementsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canViewFinance(user.designation)) redirect("/app");

  const [accounts, grouped] = await Promise.all([
    prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      _sum: { debit: true, credit: true },
    }),
  ]);
  const sums = new Map(grouped.map((g) => [g.accountId, g._sum]));

  const byType = (t: AccountType) =>
    accounts
      .filter((a) => a.type === t)
      .map((a) => {
        const s = sums.get(a.id);
        return { a, bal: balance(t, s?.debit ?? 0, s?.credit ?? 0) };
      });

  const revenue = byType("REVENUE");
  const expense = byType("EXPENSE");
  const asset = byType("ASSET");
  const liability = byType("LIABILITY");
  const equity = byType("EQUITY");

  const totalRevenue = revenue.reduce((s, r) => s + r.bal, 0);
  const totalExpense = expense.reduce((s, r) => s + r.bal, 0);
  const netIncome = totalRevenue - totalExpense;

  const totalAssets = asset.reduce((s, r) => s + r.bal, 0);
  const totalLiabilities = liability.reduce((s, r) => s + r.bal, 0);
  const totalEquity = equity.reduce((s, r) => s + r.bal, 0) + netIncome; // retained earnings

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financial Statements</h1>
        <p className="text-sm text-muted-foreground">
          Computed live from the general ledger (ADR-0004). Amounts in PKR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit &amp; Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Revenue
          </p>
          {revenue.map((r) => (
            <Row key={r.a.id} label={`${r.a.code} ${r.a.name}`} value={r.bal} />
          ))}
          <Row label="Total revenue" value={totalRevenue} bold />
          <p className="mb-1 mt-3 text-xs font-medium uppercase text-muted-foreground">
            Expenses
          </p>
          {expense.map((r) => (
            <Row key={r.a.id} label={`${r.a.code} ${r.a.name}`} value={r.bal} />
          ))}
          <Row label="Total expenses" value={totalExpense} bold />
          <div className="mt-3 border-t pt-2">
            <Row label="Net income" value={netIncome} bold />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Assets
          </p>
          {asset.map((r) => (
            <Row key={r.a.id} label={`${r.a.code} ${r.a.name}`} value={r.bal} />
          ))}
          <Row label="Total assets" value={totalAssets} bold />

          <p className="mb-1 mt-3 text-xs font-medium uppercase text-muted-foreground">
            Liabilities
          </p>
          {liability.map((r) => (
            <Row key={r.a.id} label={`${r.a.code} ${r.a.name}`} value={r.bal} />
          ))}
          <Row label="Total liabilities" value={totalLiabilities} bold />

          <p className="mb-1 mt-3 text-xs font-medium uppercase text-muted-foreground">
            Equity
          </p>
          {equity.map((r) => (
            <Row key={r.a.id} label={`${r.a.code} ${r.a.name}`} value={r.bal} />
          ))}
          <Row label="Retained earnings (net income)" value={netIncome} />
          <Row label="Total equity" value={totalEquity} bold />

          <div className="mt-3 border-t pt-2">
            <Row
              label="Liabilities + Equity"
              value={totalLiabilities + totalEquity}
              bold
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
