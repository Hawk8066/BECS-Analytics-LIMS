import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAccessPR } from "@/lib/procurement/access";
import { formatDate } from "@/lib/format";
import { PrintButton } from "../../[id]/print/print-button";

// Blank down to a minimum so the printed order matches a paper form.
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
  return paisa == null ? "—" : "PKR " + (paisa / 100).toLocaleString("en-PK");
}

export default async function POPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { vendor: true, lines: true, pr: true },
  });
  if (!po) notFound();
  if (!canAccessPR(user, po.pr)) notFound();

  const facility = await prisma.facility.findUnique({
    where: { id: po.pr.facilityId },
  });
  const issuedBy = await nameOf(po.issuedById);
  const blanks = Math.max(0, MIN_ROWS - po.lines.length);
  const packOf = (packSize: string | null, unit: string | null) =>
    packSize ? `${packSize}${unit ? ` ${unit}` : ""}` : (unit ?? "");

  return (
    <>
      {/* Isolate the document for printing regardless of the app shell. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #po-doc, #po-doc * { visibility: visible !important; }
          #po-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="mx-auto max-w-[850px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/procurement/${po.prId}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to request
          </Link>
          <PrintButton />
        </div>

        <div
          id="po-doc"
          className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
        >
          {/* Form header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-2">
            <div>
              <div className="text-lg font-bold tracking-tight">
                BECS Analytics
              </div>
              <div className="text-xl font-semibold">PURCHASE ORDER</div>
              {facility?.name && (
                <div className="text-xs text-neutral-600">{facility.name}</div>
              )}
            </div>
            <div className="text-right text-[11px] leading-5">
              <div>
                PO No: <span className="font-mono font-semibold">{po.poNo}</span>
              </div>
              <div>Date: {formatDate(po.createdAt)}</div>
              <div>Status: {po.status}</div>
              <div>
                Ref PR: <span className="font-mono">{po.pr.prNo}</span>
              </div>
            </div>
          </div>

          {/* Vendor block */}
          <div className="mt-3 text-[12px] leading-5">
            <div className="font-semibold">To:</div>
            <div className="font-medium">{po.vendor?.company ?? "—"}</div>
            {po.vendor?.address && <div>{po.vendor.address}</div>}
            <div className="text-neutral-700">
              {po.vendor?.contactNumber
                ? `Contact: ${po.vendor.contactNumber}`
                : ""}
              {po.vendor?.vendorNo ? `   ·   Vendor No: ${po.vendor.vendorNo}` : ""}
            </div>
            {(po.vendor?.ntn || po.vendor?.stn) && (
              <div className="text-neutral-700">
                {po.vendor?.ntn ? `NTN: ${po.vendor.ntn}` : ""}
                {po.vendor?.stn ? `   ·   STN: ${po.vendor.stn}` : ""}
              </div>
            )}
          </div>

          {/* Line items */}
          <table className="mt-4 w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {[
                  ["Sr. #", "w-10"],
                  ["Description", ""],
                  ["Pack size", "w-24"],
                  ["Qty", "w-14"],
                  ["Unit price", "w-28"],
                  ["Amount", "w-28"],
                ].map(([label, w]) => (
                  <th
                    key={label}
                    className={`border border-black px-2 py-1 text-left align-top font-semibold ${w}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l, i) => {
                const amount = l.rate == null ? null : l.rate * l.quantity;
                return (
                  <tr key={l.id}>
                    <td className="border border-black px-2 py-1 text-center align-top">
                      {i + 1}
                    </td>
                    <td className="border border-black px-2 py-1 align-top">
                      {l.description}
                    </td>
                    <td className="border border-black px-2 py-1 align-top">
                      {packOf(l.packSize, l.unit)}
                    </td>
                    <td className="border border-black px-2 py-1 text-center align-top">
                      {l.quantity}
                    </td>
                    <td className="border border-black px-2 py-1 text-right align-top tabular-nums">
                      {pkr(l.rate)}
                    </td>
                    <td className="border border-black px-2 py-1 text-right align-top tabular-nums">
                      {pkr(amount)}
                    </td>
                  </tr>
                );
              })}
              {Array.from({ length: blanks }).map((_, i) => (
                <tr key={`b${i}`}>
                  <td className="border border-black px-2 py-3 text-center">
                    {po.lines.length + i + 1}
                  </td>
                  <td className="border border-black px-2 py-3" />
                  <td className="border border-black px-2 py-3" />
                  <td className="border border-black px-2 py-3" />
                  <td className="border border-black px-2 py-3" />
                  <td className="border border-black px-2 py-3" />
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="border border-black px-2 py-1" colSpan={5}>
                  Total
                </td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">
                  {pkr(po.amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="mt-10 grid grid-cols-2 gap-8 text-[12px]">
            <div>
              <div className="border-t border-black pt-1">
                Issued by: {issuedBy}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block border-t border-black pt-1">
                For BECS Analytics
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
