import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageQuotations } from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
import { PrintButton } from "./print-button";

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManageQuotations(user.designation)) redirect("/app/quotations");

  const q = await prisma.testQuotation.findUnique({
    where: { id },
    include: { client: true, items: { orderBy: { name: "asc" } } },
  });
  if (!q) notFound();

  const anyDiscount = q.items.some((it) => it.discount > 0);
  const netTotal =
    q.items.reduce((s, it) => s + (it.price - it.discount), 0) * q.sampleQty;
  const tax = q.total - netTotal;

  const c = q.client;
  const addressLines = [
    c.addressLine1,
    c.addressLine2,
    c.addressLine3,
    [c.city, c.province, c.country].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];

  return (
    <>
      {/* The app shell is hidden in print (see app/layout); just set the page. */}
      <style>{`@media print { @page { size: A4; margin: 16mm; } }`}</style>

      <div className="mx-auto max-w-[850px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/quotations/${q.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to quotation
          </Link>
          <PrintButton />
        </div>

        <div
          id="quote-doc"
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
              <div className="text-2xl font-semibold">QUOTATION</div>
              <div className="font-mono text-sm">{q.quoteNo}</div>
            </div>
          </div>

          {/* Client + meta */}
          <div className="mt-4 flex justify-between gap-8 text-[13px]">
            <div>
              <div className="text-[11px] font-semibold uppercase text-neutral-500">
                Quotation for
              </div>
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
                {formatDate(q.createdAt)}
              </div>
              {q.validUntil && (
                <div>
                  <span className="text-neutral-500">Valid until: </span>
                  {formatDate(q.validUntil)}
                </div>
              )}
              {q.sector && (
                <div>
                  <span className="text-neutral-500">Sector: </span>
                  {q.sector}
                </div>
              )}
              <div>
                <span className="text-neutral-500">Priority: </span>
                {q.priority === "URGENT" ? "Urgent" : "Normal"}
              </div>
              <div>
                <span className="text-neutral-500">Status: </span>
                {q.status}
              </div>
            </div>
          </div>

          {(q.sampleType || q.sampleQty > 1) && (
            <div className="mt-3 text-[13px]">
              <span className="text-neutral-500">Sample: </span>
              {q.sampleType ?? "—"} · {q.sampleQty} sample{q.sampleQty === 1 ? "" : "s"}
            </div>
          )}

          {/* Line items */}
          <table className="mt-6 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1.5 text-left font-semibold">Item</th>
                <th className="py-1.5 text-left font-semibold">Type</th>
                <th className="py-1.5 text-right font-semibold">Price</th>
                {anyDiscount && (
                  <>
                    <th className="py-1.5 text-right font-semibold">Discount</th>
                    <th className="py-1.5 text-right font-semibold">Net</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {q.items.map((it) => (
                <tr key={it.id} className="border-b border-neutral-300">
                  <td className="py-1.5">{it.name}</td>
                  <td className="py-1.5 text-neutral-600">
                    {it.kind === "PACKAGE" ? "Package" : "Parameter"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{pkr(it.price)}</td>
                  {anyDiscount && (
                    <>
                      <td className="py-1.5 text-right tabular-nums text-neutral-600">
                        {it.discount > 0 ? `− ${pkr(it.discount)}` : "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {pkr(it.price - it.discount)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <table className="text-[13px]">
              <tbody>
                {(q.sampleQty > 1 || q.taxPct > 0) && (
                  <tr>
                    <td className="py-0.5 pr-8 text-right text-neutral-600">
                      Subtotal{q.sampleQty > 1 ? ` (× ${q.sampleQty} samples)` : ""}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{pkr(netTotal)}</td>
                  </tr>
                )}
                {q.taxPct > 0 && (
                  <tr>
                    <td className="py-0.5 pr-8 text-right text-neutral-600">
                      Services tax ({q.taxPct}%)
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-neutral-600">
                      + {pkr(tax)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-black">
                  <td className="py-1 pr-8 text-right font-semibold">Total</td>
                  <td className="py-1 text-right font-semibold tabular-nums">
                    {pkr(q.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {q.note && (
            <p className="mt-6 whitespace-pre-line text-[12px]">
              <span className="font-semibold">Note:</span> {q.note}
            </p>
          )}

          <div className="mt-10 border-t border-neutral-300 pt-3 text-[11px] text-neutral-500">
            Amounts in PKR. Quotation valid subject to the terms above.
          </div>
        </div>
      </div>
    </>
  );
}
