import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  canViewFinance,
  canManageOutsourceBilling,
  canRecordPayment,
} from "@/lib/auth/perms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordLabPaymentButton } from "./record-lab-payment-button";

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

export default async function OutsourceBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (
    !canViewFinance(user.designation) &&
    !canManageOutsourceBilling(user.designation) &&
    !canRecordPayment(user.designation)
  )
    redirect("/app");

  const bill = await prisma.outsourceBill.findUnique({
    where: { id },
    include: {
      outsourceLab: { select: { id: true, name: true, labNo: true } },
      items: { orderBy: { name: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!bill) notFound();
  if (!user.canReadCrossSection && bill.facilityId !== user.facilityId) notFound();

  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const balance = bill.amount - paid;
  const tax = bill.amount - bill.subtotal;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{bill.billNo}</h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/app/outsource-labs/${bill.outsourceLab.id}`}
              className="underline"
            >
              {bill.outsourceLab.name}
            </Link>
            {bill.labInvoiceNo ? ` · lab invoice ${bill.labInvoiceNo}` : ""}
          </p>
        </div>
        <Badge>{bill.status}</Badge>
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 gap-4 pt-6 text-sm">
          <div>
            <div className="text-muted-foreground">Amount</div>
            <div className="text-lg font-semibold">{pkr(bill.amount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Paid</div>
            <div className="text-lg font-semibold">{pkr(paid)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Balance</div>
            <div className="text-lg font-semibold">{pkr(balance)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billed tests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab ID</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-xs">{it.sampleLabId}</TableCell>
                  <TableCell>{it.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{pkr(it.price)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={2} className="text-right text-muted-foreground">
                  Net
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {pkr(bill.subtotal)}
                </TableCell>
              </TableRow>
              {tax > 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-right text-muted-foreground">
                    Input tax ({bill.taxPct}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    + {pkr(tax)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={2} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {pkr(bill.amount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell>{p.method || "—"}</TableCell>
                  <TableCell className="text-right">{pkr(p.amount)}</TableCell>
                </TableRow>
              ))}
              {bill.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No payments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {balance > 0 && canRecordPayment(user.designation) && (
            <RecordLabPaymentButton billId={bill.id} balance={balance} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
