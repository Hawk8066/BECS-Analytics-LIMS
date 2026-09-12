import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canViewFinance, canManageOutsourceBilling } from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompositionBar } from "@/components/finance/composition-bar";
import { Money } from "@/components/finance/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseForm } from "./expense-form";

export default async function ExpensesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  const canRecord = canManageOutsourceBilling(user.designation);
  if (!canViewFinance(user.designation) && !canRecord) redirect("/app");

  const [expenses, byCategory] = await Promise.all([
    prisma.expense.findMany({ orderBy: { spentAt: "desc" }, take: 100 }),
    prisma.expense.groupBy({ by: ["category"], _sum: { amount: true } }),
  ]);
  const sumOf = new Map(byCategory.map((g) => [g.category, g._sum.amount ?? 0]));
  const total = [...sumOf.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Utilities &amp; Other Payments</h1>
        <p className="text-sm text-muted-foreground">
          Running costs paid outright — electricity, rent, transport, upkeep. Each
          one posts straight to the ledger against bank or cash.
        </p>
      </div>

      {canRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record a payment</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By category</CardTitle>
        </CardHeader>
        <CardContent>
          <CompositionBar
            emptyLabel="Nothing recorded yet."
            slices={EXPENSE_CATEGORIES.map((c) => ({
              key: c,
              label: EXPENSE_CATEGORY_LABELS[c],
              value: sumOf.get(c) ?? 0,
            }))}
          />
          <div className="mt-3 flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Total</span>
            <Money value={total} />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Paid to</TableHead>
              <TableHead>From</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{x.expenseNo}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(x.spentAt)}
                </TableCell>
                <TableCell>{EXPENSE_CATEGORY_LABELS[x.category]}</TableCell>
                <TableCell>{x.payee || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{x.paidFrom}</TableCell>
                <TableCell className="text-right">
                  <Money value={x.amount} />
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No payments recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
