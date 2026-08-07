import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { packQtyLabel } from "@/lib/procurement/format";
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

function pkr(paisa: number | null | undefined): string {
  return paisa == null ? "—" : "PKR " + (paisa / 100).toLocaleString("en-PK");
}

export default async function VendorQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "VENDOR" || !user.vendorId) redirect("/app");

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      lines: true,
      pr: {
        select: {
          id: true,
          prNo: true,
          createdAt: true,
          note: true,
          lines: true,
        },
      },
    },
  });
  // A vendor may only view its own quotations — never another vendor's rates.
  if (!quotation || quotation.vendorId !== user.vendorId) notFound();

  // The PO (if any) issued to THIS vendor for this request.
  const po = await prisma.purchaseOrder.findFirst({
    where: { prId: quotation.prId, vendorId: user.vendorId },
    select: { id: true, poNo: true },
  });

  const byPrLine = new Map(quotation.lines.map((l) => [l.prLineId, l]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor" className="text-sm text-muted-foreground underline">
          ← Back to portal
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Your quotation</h1>
          {quotation.selected ? (
            <Badge>Awarded</Badge>
          ) : (
            <Badge variant="secondary">Not awarded</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Against <span className="font-mono">{quotation.pr.prNo}</span> ·{" "}
          {formatDate(quotation.pr.createdAt)}
        </p>
      </div>

      {po && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          A purchase order was issued to you for this request:{" "}
          <Link
            href={`/vendor/po/${po.id}`}
            className="font-mono font-medium underline"
          >
            {po.poNo}
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items & your rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Sr#</TableHead>
                  <TableHead>Item requested</TableHead>
                  <TableHead>Requested spec</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Your specification</TableHead>
                  <TableHead className="text-right">Your rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Awarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.pr.lines.map((l, i) => {
                  const q = byPrLine.get(l.id);
                  const amount = q ? q.rate * l.quantity : null;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {l.description}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.specification || "—"}
                      </TableCell>
                      <TableCell>
                        {packQtyLabel(l.quantity, l.packSize, l.unit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {q?.specification || (q ? "—" : "not quoted")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {q ? pkr(q.rate) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pkr(amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {q?.selected ? <Badge>Yes</Badge> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-medium">
                  <TableCell colSpan={6} className="text-right">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pkr(quotation.amount)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {quotation.note && (
            <p className="mt-3 text-sm text-muted-foreground">
              Note: {quotation.note}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
