import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canViewFinance } from "@/lib/auth/perms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function pkr(paisa: number): string {
  return (paisa / 100).toLocaleString("en-PK", { minimumFractionDigits: 2 });
}

export default async function FinancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canViewFinance(user.designation)) redirect("/app");

  const [accounts, grouped, journals] = await Promise.all([
    prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntry.findMany({
      include: { lines: { include: { account: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const sums = new Map(grouped.map((g) => [g.accountId, g._sum]));
  let totalDr = 0;
  let totalCr = 0;
  const rows = accounts.map((a) => {
    const s = sums.get(a.id);
    const dr = s?.debit ?? 0;
    const cr = s?.credit ?? 0;
    totalDr += dr;
    totalCr += cr;
    return { a, dr, cr };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance — Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Full double-entry GL (ADR-0004). All amounts in PKR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trial Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ a, dr, cr }) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.code}
                    </span>{" "}
                    {a.name}
                  </TableCell>
                  <TableCell className="text-right">{dr ? pkr(dr) : "—"}</TableCell>
                  <TableCell className="text-right">{cr ? pkr(cr) : "—"}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{pkr(totalDr)}</TableCell>
                <TableCell className="text-right">{pkr(totalCr)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent journal entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {journals.length === 0 && (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          )}
          {journals.map((j) => (
            <div key={j.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-mono text-xs">{j.entryNo}</span>
                <span className="text-muted-foreground">{j.memo}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {j.lines.map((l) => (
                  <li key={l.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {l.account.code} {l.account.name}
                    </span>
                    <span>
                      {l.debit ? `Dr ${pkr(l.debit)}` : `Cr ${pkr(l.credit)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
