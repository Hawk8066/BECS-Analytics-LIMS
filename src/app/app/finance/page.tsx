import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canViewFinance } from "@/lib/auth/perms";
import { getFinanceSummary } from "@/lib/finance/summary";
import { formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile, TileRow } from "@/components/finance/stat-tile";
import { CompositionBar } from "@/components/finance/composition-bar";
import { Money } from "@/components/finance/money";

const QUICK_LINKS = [
  { href: "/app/invoices", label: "Invoice a quotation" },
  { href: "/app/finance/vendor-bills", label: "Record a vendor bill" },
  { href: "/app/finance/expenses", label: "Record an expense" },
  { href: "/app/finance/outsource-bills", label: "External lab payables" },
];

export default async function FinanceDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canViewFinance(user.designation)) redirect("/app");

  const [s, recentInvoices, recentBills, recentExpenses] = await Promise.all([
    getFinanceSummary(),
    prisma.invoice.findMany({
      include: { client: { select: { company: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.vendorBill.findMany({
      include: { vendor: { select: { company: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.expense.findMany({ orderBy: { spentAt: "desc" }, take: 5 }),
  ]);
  const e = s.expenses.byGroup;
  const totalPayable = s.vendors.outstanding + s.labs.outstanding;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-sm text-muted-foreground">
          Live from the general ledger. Company-wide, in PKR.
        </p>
      </div>

      <TileRow>
        <StatTile
          label="Income from tests"
          value={s.income.net}
          tone="#2a78d6"
          hint={`${s.income.records.count} invoice${s.income.records.count === 1 ? "" : "s"}`}
          href="/app/finance/statements"
        />
        <StatTile
          label="Received from clients"
          value={s.income.received}
          tone="#1baf7a"
          hint="banked"
          href="/app/finance/invoices"
        />
        <StatTile
          label="Receivable"
          value={s.income.outstanding}
          tone="#eda100"
          hint="still owed to us"
          href="/app/finance/invoices"
        />
        <StatTile
          label="Payable to vendors"
          value={s.vendors.outstanding}
          tone="#eb6834"
          hint="unpaid supplier bills"
          href="/app/finance/vendor-bills"
        />
        <StatTile
          label="Payable to external labs"
          value={s.labs.outstanding}
          tone="#eb6834"
          hint="subcontracted testing"
          href="/app/finance/outsource-bills"
        />
        <StatTile
          label="Total expenses"
          value={s.expenses.total}
          tone="#4a3aa7"
          href="/app/finance/statements"
        />
        <StatTile
          label="Net income"
          value={s.netIncome}
          tone={s.netIncome < 0 ? "#e34948" : "#008300"}
          hint="revenue less expenses"
          href="/app/finance/statements"
        />
      </TileRow>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where the money goes</CardTitle>
          </CardHeader>
          <CardContent>
            <CompositionBar
              emptyLabel="No expenses posted yet."
              slices={[
                { key: "vendorPurchases", label: "Vendor purchases", value: e.vendorPurchases },
                { key: "utilitiesOther", label: "Utilities & other payments", value: e.utilitiesOther },
                { key: "externalLabs", label: "External labs", value: e.externalLabs },
                { key: "payroll", label: "Payroll", value: e.payroll },
              ]}
            />
            <div className="mt-3 flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total expenses</span>
              <Money value={s.expenses.total} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Owed to us vs owed by us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Receivable from clients
                </span>
                <Money value={s.income.outstanding} />
              </div>
              <Bar value={s.income.outstanding} max={Math.max(s.income.outstanding, totalPayable)} tone="#1baf7a" />
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payable to vendors</span>
                <Money value={s.vendors.outstanding} />
              </div>
              <Bar value={s.vendors.outstanding} max={Math.max(s.income.outstanding, totalPayable)} tone="#eb6834" />
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Payable to external labs
                </span>
                <Money value={s.labs.outstanding} />
              </div>
              <Bar value={s.labs.outstanding} max={Math.max(s.income.outstanding, totalPayable)} tone="#eda100" />
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Net position</span>
              <Money value={s.income.outstanding - totalPayable} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            {q.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentInvoices.length === 0 && (
              <p className="text-muted-foreground">None yet.</p>
            )}
            {recentInvoices.map((i) => (
              <Link
                key={i.id}
                href={`/app/finance/invoices/${i.id}`}
                className="flex items-baseline justify-between gap-2 hover:underline"
              >
                <span className="min-w-0 truncate">
                  {i.client.company}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {formatDate(i.createdAt)}
                  </span>
                </span>
                <Money value={i.amount} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent vendor bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentBills.length === 0 && (
              <p className="text-muted-foreground">None yet.</p>
            )}
            {recentBills.map((b) => (
              <Link
                key={b.id}
                href={`/app/finance/vendor-bills/${b.id}`}
                className="flex items-baseline justify-between gap-2 hover:underline"
              >
                <span className="min-w-0 truncate">
                  {b.vendor.company}
                  <Badge variant="outline" className="ml-1.5 text-[10px]">
                    {b.status}
                  </Badge>
                </span>
                <Money value={b.amount} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentExpenses.length === 0 && (
              <p className="text-muted-foreground">None yet.</p>
            )}
            {recentExpenses.map((x) => (
              <div key={x.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  {x.payee ?? EXPENSE_CATEGORY_LABELS[x.category]}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {formatDate(x.spentAt)}
                  </span>
                </span>
                <Money value={x.amount} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** A single magnitude against a shared scale — same units, one axis. */
function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full"
        style={{ width: `${pct}%`, backgroundColor: tone }}
      />
    </div>
  );
}
