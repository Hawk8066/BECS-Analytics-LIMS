import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canApprovePayroll, canManagePayroll } from "@/lib/auth/perms";
import { approvePayrollRun } from "@/lib/actions/payroll";
import { Button } from "@/components/ui/button";
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
  return (paisa / 100).toLocaleString("en-PK");
}

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManagePayroll(user.designation)) redirect("/app");

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!run) notFound();

  const users = await prisma.user.findMany({
    where: { id: { in: run.items.map((i) => i.userId) } },
    include: { profile: { select: { fullName: true } } },
  });
  const name = new Map(
    users.map((u) => [u.id, u.profile?.fullName ?? u.email]),
  );

  const gross = run.items.reduce((s, i) => s + i.gross, 0);
  const net = run.items.reduce((s, i) => s + i.netPay, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{run.runNo}</h1>
          <p className="text-sm text-muted-foreground">Period {run.period}</p>
        </div>
        <Badge variant={run.status === "APPROVED" ? "default" : "outline"}>
          {run.status}
        </Badge>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div className="text-sm">
            <span className="text-muted-foreground">Gross</span>{" "}
            <span className="font-semibold">PKR {pkr(gross)}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Net</span>{" "}
            <span className="font-semibold">PKR {pkr(net)}</span>
          </div>
          {run.status === "DRAFT" && canApprovePayroll(user.designation) && (
            <form action={approvePayrollRun}>
              <input type="hidden" name="runId" value={run.id} />
              <Button type="submit">Approve &amp; post (COO)</Button>
            </form>
          )}
          {run.status === "APPROVED" && (
            <span className="text-sm text-muted-foreground">Posted to GL</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payslip items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Cash (n/t)</TableHead>
                <TableHead className="text-right">Income tax</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">EOBI</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{name.get(i.userId) ?? "—"}</TableCell>
                  <TableCell className="text-right">{pkr(i.gross)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {i.cashAllowance ? pkr(i.cashAllowance) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{pkr(i.incomeTax)}</TableCell>
                  <TableCell className="text-right">{pkr(i.providentFund)}</TableCell>
                  <TableCell className="text-right">{pkr(i.eobi)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {pkr(i.netPay)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
