import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canIssueInvoice,
  canRecordPayment,
  canViewFinance,
} from "@/lib/auth/perms";
import { PaymentForm } from "./payment-form";
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

export default async function InvoiceDetailPage({
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
    !canIssueInvoice(user.designation) &&
    !canRecordPayment(user.designation)
  )
    redirect("/app");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!invoice) notFound();
  if (!user.canReadCrossSection && invoice.facilityId !== user.facilityId)
    notFound();

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.amount - paid;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{invoice.invoiceNo}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.client.company}
          </p>
        </div>
        <Badge>{invoice.status}</Badge>
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 gap-4 pt-6 text-sm">
          <div>
            <div className="text-muted-foreground">Amount</div>
            <div className="text-lg font-semibold">{pkr(invoice.amount)}</div>
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
              {invoice.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {p.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>{p.method || "—"}</TableCell>
                  <TableCell className="text-right">{pkr(p.amount)}</TableCell>
                </TableRow>
              ))}
              {invoice.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No payments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {balance > 0 && canRecordPayment(user.designation) && (
            <PaymentForm invoiceId={invoice.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
