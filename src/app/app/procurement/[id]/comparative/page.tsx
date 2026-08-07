import Link from "next/link";
import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAccessPR } from "@/lib/procurement/access";
import { specDiffers } from "@/lib/procurement/spec";
import { packQtyLabel } from "@/lib/procurement/format";
import { formatDate } from "@/lib/format";
import { PrintButton } from "../print/print-button";

// Minimum blank rows so the printed statement matches the paper form.
const MIN_ROWS = 6;

async function nameOf(id: string | null): Promise<string> {
  if (!id) return "";
  const u = await prisma.user.findUnique({
    where: { id },
    include: { profile: { select: { fullName: true } } },
  });
  return u?.profile?.fullName ?? u?.email ?? "";
}

function pkr(paisa: number | null | undefined): string {
  return paisa == null ? "" : "PKR " + (paisa / 100).toLocaleString("en-PK");
}

export default async function ComparativePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      lines: true,
      quotations: {
        include: { vendor: true, lines: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!pr) notFound();
  if (!canAccessPR(user, pr)) notFound();

  const quotations = pr.quotations;
  // cell lookup: cells[vendorIdx][prLineId]
  const cellOf = (qIdx: number, prLineId: string) =>
    quotations[qIdx].lines.find((l) => l.prLineId === prLineId);
  const wonBy = (prLineId: string): string | null => {
    for (const q of quotations)
      if (q.lines.find((l) => l.prLineId === prLineId && l.selected))
        return q.vendor.company;
    return null;
  };

  const preparedBy = await nameOf(pr.quotations[0]?.createdById ?? null);
  const approvedBy = await nameOf(pr.approvedById);
  const blanks = Math.max(0, MIN_ROWS - pr.lines.length);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cs-doc, #cs-doc * { visibility: visible !important; }
          #cs-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>

      <div className="mx-auto max-w-[1100px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/procurement/${pr.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to request
          </Link>
          <PrintButton />
        </div>

        <div
          id="cs-doc"
          className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
        >
          {/* Form header / document control block */}
          <div className="flex items-start justify-between border-b-2 border-black pb-2">
            <div>
              <div className="text-lg font-bold tracking-tight">
                BECS Analytics
              </div>
              <div className="text-xl font-semibold">COMPARATIVE STATEMENT</div>
              <div className="text-xs text-neutral-600">
                Comparison of quotations received from different vendors
              </div>
            </div>
            <div className="text-right text-[11px] leading-5">
              <div>Form: 6-B</div>
              <div>
                PR No: <span className="font-mono">{pr.prNo}</span>
              </div>
              <div>Date: {formatDate(new Date())}</div>
            </div>
          </div>

          {quotations.length === 0 ? (
            <p className="mt-6 text-sm">No quotations have been recorded.</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="border border-black px-2 py-1 align-bottom font-semibold"
                  >
                    Sr#
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-black px-2 py-1 text-left align-bottom font-semibold"
                  >
                    Specifications / Descriptions of store
                  </th>
                  {quotations.map((q) => (
                    <th
                      key={q.id}
                      colSpan={2}
                      className="border border-black px-2 py-1 text-center font-semibold"
                    >
                      {q.vendor.company}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="border border-black px-2 py-1 text-left align-bottom font-semibold"
                  >
                    Selected vendor / Justification
                  </th>
                </tr>
                <tr>
                  {quotations.map((q) => (
                    <Fragment key={q.id}>
                      <th className="border border-black px-2 py-1 text-left font-medium">
                        Specification
                      </th>
                      <th className="border border-black px-2 py-1 text-right font-medium">
                        Rate
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pr.lines.map((l, i) => {
                  const won = wonBy(l.id);
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="border border-black px-2 py-1 text-center">
                        {i + 1}
                      </td>
                      <td className="border border-black px-2 py-1">
                        {l.description}
                        {l.quantity ? (
                          <span className="text-neutral-600">
                            {" "}
                            ({packQtyLabel(l.quantity, l.packSize, l.unit)})
                          </span>
                        ) : null}
                        {l.specification ? (
                          <div className="text-[10px] text-neutral-600">
                            Requested: {l.specification}
                          </div>
                        ) : null}
                      </td>
                      {quotations.map((q, qIdx) => {
                        const c = cellOf(qIdx, l.id);
                        const differs =
                          c && specDiffers(c.specification, l.specification);
                        return (
                          <Fragment key={q.id}>
                            <td className="border border-black px-2 py-1">
                              {c?.specification ?? ""}
                              {differs ? (
                                <span className="text-[10px] italic text-neutral-600">
                                  {" "}
                                  (≠ requested)
                                </span>
                              ) : null}
                            </td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                              {c ? pkr(c.rate) : ""}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className="border border-black px-2 py-1">
                        {won ? (
                          <>
                            <span className="font-semibold">{won}</span>
                            {l.selectionNote ? ` — ${l.selectionNote}` : ""}
                          </>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
                {Array.from({ length: blanks }).map((_, i) => (
                  <tr key={`b${i}`}>
                    <td className="border border-black px-2 py-3 text-center">
                      {pr.lines.length + i + 1}
                    </td>
                    <td className="border border-black px-2 py-3" />
                    {quotations.map((q) => (
                      <Fragment key={q.id}>
                        <td className="border border-black px-2 py-3" />
                        <td className="border border-black px-2 py-3" />
                      </Fragment>
                    ))}
                    <td className="border border-black px-2 py-3" />
                  </tr>
                ))}
                {/* Vendor totals */}
                <tr className="font-semibold">
                  <td className="border border-black px-2 py-1" />
                  <td className="border border-black px-2 py-1 text-right">
                    Total
                  </td>
                  {quotations.map((q) => (
                    <td
                      key={q.id}
                      colSpan={2}
                      className="border border-black px-2 py-1 text-right tabular-nums"
                    >
                      {pkr(q.amount)}
                    </td>
                  ))}
                  <td className="border border-black px-2 py-1" />
                </tr>
              </tbody>
            </table>
          )}

          {/* Signatures */}
          <div className="mt-10 grid grid-cols-2 gap-8 text-[12px]">
            <div>
              <div className="border-t border-black pt-1">
                Prepared by: {preparedBy}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block border-t border-black pt-1">
                Approved By: {approvedBy || "________________________"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
