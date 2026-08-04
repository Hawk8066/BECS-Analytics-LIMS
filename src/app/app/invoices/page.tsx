import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canIssueInvoice, canViewFinance } from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
import { InvoiceQuotationButton } from "./invoice-quotation-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ISSUED: "secondary",
  PARTIAL: "outline",
  PAID: "default",
};

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

export default async function TestingInvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  const canIssue = canIssueInvoice(user.designation);
  if (!canIssue && !canViewFinance(user.designation)) redirect("/app");

  const facilityScope = user.canReadCrossSection ? {} : { facilityId: user.facilityId };
  const quoteScope = user.canReadCrossSection
    ? {}
    : { client: { facilityId: user.facilityId } };

  const [invoices, billable] = await Promise.all([
    prisma.invoice.findMany({
      where: facilityScope,
      include: {
        client: { select: { company: true } },
        quotation: { select: { quoteNo: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Accepted quotations with a positive total that haven't been invoiced yet.
    prisma.testQuotation.findMany({
      where: { status: "ACCEPTED", total: { gt: 0 }, invoices: { none: {} }, ...quoteScope },
      include: { client: { select: { company: true } }, items: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Bill clients for accepted quotations; amounts post to the ledger.
        </p>
      </div>

      {/* Accepted quotations ready to invoice */}
      {canIssue && billable.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Accepted quotations to invoice ({billable.length})
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billable.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/app/quotations/${q.id}`} className="underline">
                        {q.quoteNo}
                      </Link>
                    </TableCell>
                    <TableCell>{q.client.company}</TableCell>
                    <TableCell className="text-right tabular-nums">{pkr(q.total)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(q.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <InvoiceQuotationButton
                        quote={{
                          id: q.id,
                          quoteNo: q.quoteNo,
                          clientLabel: q.client.company,
                          subtotal: q.subtotal,
                          discountKind: q.discountKind,
                          discountValue: q.discountValue,
                          taxPct: q.taxPct,
                          total: q.total,
                          // Bill the quoted net (price less any per-line quote
                          // discount) times the sample quantity; the invoice can
                          // discount further on top.
                          items: q.items.map((it) => ({
                            id: it.id,
                            kind: it.kind,
                            name: it.name,
                            price: (it.price - it.discount) * q.sampleQty,
                          })),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* All invoices */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Issued invoices</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Quotation</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/app/finance/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.invoiceNo}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.client.company}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {inv.quotation?.quoteNo ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pkr(inv.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "secondary"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(inv.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
