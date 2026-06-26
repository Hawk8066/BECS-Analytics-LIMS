import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManagePayroll } from "@/lib/auth/perms";
import { createPayrollRun } from "@/lib/actions/payroll";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

export default async function PayrollPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManagePayroll(user.designation)) redirect("/app");

  const runs = await prisma.payrollRun.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    include: { items: { select: { netPay: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <Link
          href="/app/finance/payroll/structures"
          className={buttonVariants({ variant: "outline" })}
        >
          Salary structures
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prepare a monthly run</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPayrollRun} className="flex items-end gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Period (YYYY-MM)</label>
              <input
                name="period"
                placeholder="2026-06"
                required
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <Button type="submit">Prepare run</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run No</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead className="text-right">Total net</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/app/finance/payroll/${r.id}`}
                    className="hover:underline"
                  >
                    {r.runNo}
                  </Link>
                </TableCell>
                <TableCell>{r.period}</TableCell>
                <TableCell>{r.items.length}</TableCell>
                <TableCell className="text-right">
                  {pkr(r.items.reduce((s, i) => s + i.netPay, 0))}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "APPROVED" ? "default" : "outline"}>
                    {r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No payroll runs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
