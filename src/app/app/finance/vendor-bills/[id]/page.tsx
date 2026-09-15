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
import { Money } from "@/components/finance/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordVendorPaymentButton } from "./record-vendor-payment-button";

export default async function VendorBillDetailPage({
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

  const bill = await prisma.vendorBill.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, company: true, vendorNo: true } },
      po: { select: { id: true, poNo: true } },
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
            <Link href={`/app/vendors/${bill.vendor.id}`} className="underline">
              {bill.vendor.company}
            </Link>
            {bill.vendorInvoiceNo ? ` · vendor invoice ${bill.vendorInvoiceNo}` : ""}
            {bill.po ? (
              <>
                {" · "}
                <Link href={`/app/procurement`} className="underline">
                  {bill.po.poNo}
                </Link>
              </>
            ) : (
              ""
            )}
          </p>
        </div>
        <Badge>{bill.status}</Badge>
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 gap-4 pt-6 text-sm">
          <div>
            <div className="text-muted-foreground">Amount</div>
            <div className="text-lg font-semibold">
              <Money value={bill.amount} />
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Paid</div>
            <div className="text-lg font-semibold">
              <Money value={paid} />
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Balance</div>
            <div className="text-lg font-semibold">
              <Money value={balance} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {bill.memo && <p className="pb-2 text-muted-foreground">{bill.memo}</p>}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net</span>
            <Money value={bill.subtotal} />
          </div>
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Input tax ({bill.taxPct}%)
              </span>
              <Money value={tax} />
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <Money value={bill.amount} />
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Recorded {formatDate(bill.createdAt)}
          </p>
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
                  <TableCell className="text-right">
                    <Money value={p.amount} />
                  </TableCell>
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
            <RecordVendorPaymentButton billId={bill.id} balance={balance} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
