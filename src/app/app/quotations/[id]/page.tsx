import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageQuotations, canRegisterSample } from "@/lib/auth/perms";
import { setQuotationStatus } from "@/lib/actions/quotations";
import { loadSampleFormData } from "../../samples/form-data";
import { RegisterSampleButton } from "../../samples/register-sample-button";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const { id } = await params;
  const q = await prisma.testQuotation.findUnique({
    where: { id },
    include: {
      client: true,
      items: true,
      samples: { select: { id: true, labId: true }, orderBy: { createdAt: "asc" } },
      invoices: { select: { id: true, invoiceNo: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!q) notFound();
  const canManage = canManageQuotations(user.designation);
  const anyDiscount = q.items.some((it) => it.discount > 0);
  // Pre-tax net (per-sample net × quantity); tax = total − netTotal.
  const netTotal =
    q.items.reduce((s, it) => s + (it.price - it.discount), 0) * q.sampleQty;

  // Booking a sample against this quote opens the register form as a popup with
  // the quote pre-selected. Only load its data when that button will show.
  const canRegister = q.status === "ACCEPTED" && canRegisterSample(user.designation);
  const sampleFormData = canRegister ? await loadSampleFormData(user) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/quotations" className="underline">
              Quotations
            </Link>{" "}
            / {q.quoteNo}
          </p>
          <h1 className="text-2xl font-semibold">{q.quoteNo}</h1>
          <p className="text-sm text-muted-foreground">
            {q.client.company}
            {q.sector ? ` · ${q.sector}` : ""} · {formatDate(q.createdAt)}
          </p>
          {(q.sampleType || q.sampleQty > 1) && (
            <p className="text-sm text-muted-foreground">
              {q.sampleType ?? "Sample"} ·{" "}
              {q.sampleQty} sample{q.sampleQty === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/quotations/${q.id}/print`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Print / Save as PDF
          </Link>
          {canRegister && sampleFormData && (
            <RegisterSampleButton {...sampleFormData} defaultQuotationId={q.id} size="sm" />
          )}
          <Badge>{q.status}</Badge>
        </div>
      </div>

      {q.samples.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <span className="font-medium">
            {q.samples.length} sample{q.samples.length === 1 ? "" : "s"}
          </span>{" "}
          booked against this quotation:{" "}
          {q.samples.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/app/samples/${s.id}`} className="font-mono underline">
                {s.labId}
              </Link>
            </span>
          ))}
        </div>
      )}

      {q.invoices.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <span className="font-medium">Invoiced:</span>{" "}
          {q.invoices.map((inv, i) => (
            <span key={inv.id}>
              {i > 0 && ", "}
              <Link
                href={`/app/finance/invoices/${inv.id}`}
                className="font-mono underline"
              >
                {inv.invoiceNo}
              </Link>
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Quoted items</CardTitle>
          <div className="text-sm text-muted-foreground">
            {q.validUntil ? `Valid until ${formatDate(q.validUntil)}` : "No expiry"}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                {anyDiscount && (
                  <>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {it.kind === "PACKAGE" ? "Package" : "Parameter"}
                  </TableCell>
                  <TableCell className="text-right">{pkr(it.price)}</TableCell>
                  {anyDiscount && (
                    <>
                      <TableCell className="text-right text-muted-foreground">
                        {it.discount > 0 ? `− ${pkr(it.discount)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{pkr(it.price - it.discount)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {(q.sampleQty > 1 || q.taxPct > 0) && (
                <TableRow>
                  <TableCell
                    colSpan={anyDiscount ? 4 : 2}
                    className="text-right text-muted-foreground"
                  >
                    Subtotal{q.sampleQty > 1 ? ` (× ${q.sampleQty} samples)` : ""}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {pkr(netTotal)}
                  </TableCell>
                </TableRow>
              )}
              {q.taxPct > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={anyDiscount ? 4 : 2}
                    className="text-right text-muted-foreground"
                  >
                    Services tax ({q.taxPct}%)
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    + {pkr(q.total - netTotal)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={anyDiscount ? 4 : 2} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">{pkr(q.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {q.note && (
            <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
              {q.note}
            </p>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {(["SENT", "ACCEPTED", "REJECTED", "DRAFT"] as const)
            .filter((s) => s !== q.status)
            .map((s) => (
              <form key={s} action={setQuotationStatus}>
                <input type="hidden" name="quotationId" value={q.id} />
                <input type="hidden" name="status" value={s} />
                <Button size="sm" variant="outline" type="submit">
                  Mark {s.charAt(0) + s.slice(1).toLowerCase()}
                </Button>
              </form>
            ))}
        </div>
      )}
    </div>
  );
}
