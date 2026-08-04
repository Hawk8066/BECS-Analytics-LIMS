import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import {
  canIssueInvoice,
  canRecordPayment,
  canViewFinance,
} from "@/lib/auth/perms";
import { RecordPaymentButton } from "./record-payment-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
    include: {
      client: true,
      payments: { orderBy: { createdAt: "desc" } },
      items: { orderBy: { name: "asc" } },
      // The quotation this invoice was raised from (for legacy invoices with no
      // stored line items, and to link back to the quote).
      quotation: { include: { items: { orderBy: { name: "asc" } } } },
    },
  });
  if (!invoice) notFound();
  if (!user.canReadCrossSection && invoice.facilityId !== user.facilityId)
    notFound();

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.amount - paid;

  // Prefer the invoice's own snapshotted lines; fall back to the quotation's for
  // invoices issued before line items were stored.
  const lines =
    invoice.items.length > 0
      ? invoice.items.map((it) => ({ ...it, discount: it.discount }))
      : (invoice.quotation?.items ?? []).map((it) => ({
          id: it.id,
          kind: it.kind,
          name: it.name,
          price: it.price,
          discount: 0,
        }));
  const anyLineDiscount = lines.some((l) => l.discount > 0);
  const lineTotal = lines.reduce((s, l) => s + (l.price - l.discount), 0);
  // Rebuild the money trail: line total → total discount → net → + tax → amount.
  const totalDiscount =
    invoice.discountKind === "PERCENT"
      ? Math.round((lineTotal * invoice.discountValue) / 100)
      : invoice.discountKind === "AMOUNT"
        ? Math.min(lineTotal, invoice.discountValue)
        : 0;
  const netTotal = lineTotal - totalDiscount;
  const tax = invoice.amount - netTotal; // tax = amount − net (both snapshotted)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{invoice.invoiceNo}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.client.company}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/finance/invoices/${invoice.id}/print`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Print / Save as PDF
          </Link>
          <Badge>{invoice.status}</Badge>
        </div>
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

      {lines.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Breakdown</CardTitle>
            {invoice.quotation && (
              <Link
                href={`/app/quotations/${invoice.quotation.id}`}
                className="font-mono text-xs underline"
              >
                {invoice.quotation.quoteNo}
              </Link>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  {anyLineDiscount && (
                    <>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {it.kind === "PACKAGE" ? "Package" : "Parameter"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pkr(it.price)}</TableCell>
                    {anyLineDiscount && (
                      <>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {it.discount > 0 ? `− ${pkr(it.discount)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {pkr(it.price - it.discount)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {(invoice.discountKind !== "NONE" || invoice.taxPct > 0) && (
                  <TableRow>
                    <TableCell colSpan={anyLineDiscount ? 4 : 2} className="text-right text-muted-foreground">
                      {anyLineDiscount ? "After line discounts" : "Subtotal"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pkr(lineTotal)}
                    </TableCell>
                  </TableRow>
                )}
                {invoice.discountKind !== "NONE" && (
                  <TableRow>
                    <TableCell colSpan={anyLineDiscount ? 4 : 2} className="text-right text-muted-foreground">
                      Total discount
                      {invoice.discountKind === "PERCENT" ? ` (${invoice.discountValue}%)` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      − {pkr(totalDiscount)}
                    </TableCell>
                  </TableRow>
                )}
                {invoice.taxPct > 0 && (
                  <TableRow>
                    <TableCell colSpan={anyLineDiscount ? 4 : 2} className="text-right text-muted-foreground">
                      Services tax ({invoice.taxPct}%)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      + {pkr(tax)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={anyLineDiscount ? 4 : 2} className="text-right font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {pkr(invoice.amount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {invoice.memo && lines.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {invoice.memo}
            </p>
          </CardContent>
        </Card>
      )}

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
                    {formatDate(p.createdAt)}
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
            <RecordPaymentButton invoiceId={invoice.id} balance={balance} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
