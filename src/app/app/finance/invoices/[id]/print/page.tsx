import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canIssueInvoice,
  canRecordPayment,
  canViewFinance,
} from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
import { PrintButton } from "./print-button";

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

export default async function InvoicePrintPage({
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
      payments: { orderBy: { createdAt: "asc" } },
      items: { orderBy: { name: "asc" } },
      quotation: { include: { items: { orderBy: { name: "asc" } } } },
    },
  });
  if (!invoice) notFound();
  if (!user.canReadCrossSection && invoice.facilityId !== user.facilityId) notFound();

  // Prefer the invoice's own snapshotted lines; fall back to the quotation's.
  const lines =
    invoice.items.length > 0
      ? invoice.items.map((it) => ({ ...it }))
      : (invoice.quotation?.items ?? []).map((it) => ({
          id: it.id,
          kind: it.kind,
          name: it.name,
          price: it.price,
          discount: 0,
        }));
  const anyLineDiscount = lines.some((l) => l.discount > 0);
  const lineTotal = lines.reduce((s, l) => s + (l.price - l.discount), 0);
  const totalDiscount =
    invoice.discountKind === "PERCENT"
      ? Math.round((lineTotal * invoice.discountValue) / 100)
      : invoice.discountKind === "AMOUNT"
        ? Math.min(lineTotal, invoice.discountValue)
        : 0;
  const netTotal = lineTotal - totalDiscount;
  const tax = invoice.amount - netTotal;
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.amount - paid;

  const c = invoice.client;
  const addressLines = [
    c.addressLine1,
    c.addressLine2,
    c.addressLine3,
    [c.city, c.province, c.country].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];

  return (
    <>
      {/* The app shell is hidden in print (see app/layout), so the document just
          needs the page size — no visibility juggling that leaves blank pages. */}
      <style>{`@media print { @page { size: A4; margin: 16mm; } }`}</style>

      <div className="mx-auto max-w-[850px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/finance/invoices/${invoice.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to invoice
          </Link>
          <PrintButton />
        </div>

        <div
          id="inv-doc"
          className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/becs-br.png"
              alt="BECS Analytics"
              className="h-16 w-auto object-contain"
            />
            <div className="text-right">
              <div className="text-2xl font-semibold">INVOICE</div>
              <div className="font-mono text-sm">{invoice.invoiceNo}</div>
            </div>
          </div>

          {/* Bill-to + meta */}
          <div className="mt-4 flex justify-between gap-8 text-[13px]">
            <div>
              <div className="text-[11px] font-semibold uppercase text-neutral-500">Bill to</div>
              <div className="font-semibold">{c.company}</div>
              {addressLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              {c.contactPerson && <div>Attn: {c.contactPerson}</div>}
              {c.ntn && <div>NTN: {c.ntn}</div>}
              {c.stn && <div>STN: {c.stn}</div>}
            </div>
            <div className="text-right leading-6">
              <div>
                <span className="text-neutral-500">Date: </span>
                {formatDate(invoice.createdAt)}
              </div>
              <div>
                <span className="text-neutral-500">Client No: </span>
                <span className="font-mono">{c.clientNo}</span>
              </div>
              <div>
                <span className="text-neutral-500">Status: </span>
                {invoice.status}
              </div>
              {invoice.quotation && (
                <div>
                  <span className="text-neutral-500">Against: </span>
                  <span className="font-mono">{invoice.quotation.quoteNo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <table className="mt-6 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1.5 text-left font-semibold">Item</th>
                <th className="py-1.5 text-left font-semibold">Type</th>
                <th className="py-1.5 text-right font-semibold">Price</th>
                {anyLineDiscount && (
                  <>
                    <th className="py-1.5 text-right font-semibold">Discount</th>
                    <th className="py-1.5 text-right font-semibold">Amount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-neutral-300">
                  <td className="py-1.5">{l.name}</td>
                  <td className="py-1.5 text-neutral-600">
                    {l.kind === "PACKAGE" ? "Package" : "Parameter"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{pkr(l.price)}</td>
                  {anyLineDiscount && (
                    <>
                      <td className="py-1.5 text-right tabular-nums text-neutral-600">
                        {l.discount > 0 ? `− ${pkr(l.discount)}` : "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {pkr(l.price - l.discount)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-neutral-600">
                    {invoice.memo ?? "—"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <table className="text-[13px]">
              <tbody>
                {(invoice.discountKind !== "NONE" || invoice.taxPct > 0) && (
                  <tr>
                    <td className="py-0.5 pr-8 text-right text-neutral-600">Subtotal</td>
                    <td className="py-0.5 text-right tabular-nums">{pkr(lineTotal)}</td>
                  </tr>
                )}
                {invoice.discountKind !== "NONE" && (
                  <tr>
                    <td className="py-0.5 pr-8 text-right text-neutral-600">
                      Discount
                      {invoice.discountKind === "PERCENT" ? ` (${invoice.discountValue}%)` : ""}
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-neutral-600">
                      − {pkr(totalDiscount)}
                    </td>
                  </tr>
                )}
                {invoice.taxPct > 0 && (
                  <tr>
                    <td className="py-0.5 pr-8 text-right text-neutral-600">
                      Services tax ({invoice.taxPct}%)
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-neutral-600">
                      + {pkr(tax)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-black">
                  <td className="py-1 pr-8 text-right font-semibold">Total</td>
                  <td className="py-1 text-right font-semibold tabular-nums">
                    {pkr(invoice.amount)}
                  </td>
                </tr>
                {paid > 0 && (
                  <>
                    <tr>
                      <td className="py-0.5 pr-8 text-right text-neutral-600">Paid</td>
                      <td className="py-0.5 text-right tabular-nums">{pkr(paid)}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-8 text-right font-medium">Balance due</td>
                      <td className="py-0.5 text-right font-medium tabular-nums">
                        {pkr(balance)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-10 border-t border-neutral-300 pt-3 text-[11px] text-neutral-500">
            Amounts in PKR. This is a computer-generated invoice.
          </div>
        </div>
      </div>
    </>
  );
}
