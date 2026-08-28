import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canViewFinance, canManageOutsourceBilling } from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
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
import { VendorBillForm } from "./vendor-bill-form";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ISSUED: "secondary",
  PARTIAL: "outline",
  PAID: "default",
};

export default async function VendorBillsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  const canRecord = canManageOutsourceBilling(user.designation);
  if (!canViewFinance(user.designation) && !canRecord) redirect("/app");

  const [bills, vendors] = await Promise.all([
    prisma.vendorBill.findMany({
      include: {
        vendor: { select: { company: true } },
        po: { select: { poNo: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vendor.findMany({
      orderBy: { company: "asc" },
      select: {
        id: true,
        company: true,
        purchaseOrders: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { createdAt: "desc" },
          select: { id: true, poNo: true, amount: true },
        },
      },
    }),
  ]);

  const outstanding = bills.reduce(
    (s, b) => s + (b.amount - b.payments.reduce((p, x) => p + x.amount, 0)),
    0,
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Vendor Bills</h1>
        <p className="text-sm text-muted-foreground">
          Supplier invoices and what is still owed on them. Recording a bill posts
          the purchase to the ledger and raises a payable.
        </p>
      </div>

      {canRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record a vendor bill</CardTitle>
          </CardHeader>
          <CardContent>
            <VendorBillForm
              vendors={vendors.map((v) => ({
                id: v.id,
                company: v.company,
                pos: v.purchaseOrders,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">All bills</h2>
        <p className="text-sm text-muted-foreground">
          Outstanding: <Money value={outstanding} />
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((b) => {
              const paid = b.payments.reduce((s, p) => s + p.amount, 0);
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/app/finance/vendor-bills/${b.id}`}
                      className="hover:underline"
                    >
                      {b.billNo}
                    </Link>
                  </TableCell>
                  <TableCell>{b.vendor.company}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {b.po?.poNo ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(b.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={b.amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={b.amount - paid} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"}>
                      {b.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {bills.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No vendor bills yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
