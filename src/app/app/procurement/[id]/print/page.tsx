import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAccessPR } from "@/lib/procurement/access";
import { formatDate } from "@/lib/format";
import { designationLabel } from "@/lib/labels";
import { PrintButton } from "./print-button";

// Minimum blank rows so the printed table matches the paper requisition.
const MIN_ROWS = 6;

async function nameOf(id: string | null): Promise<string> {
  if (!id) return "";
  const u = await prisma.user.findUnique({
    where: { id },
    include: { profile: { select: { fullName: true } } },
  });
  return u?.profile?.fullName ?? u?.email ?? "";
}

export default async function PRPrintPage({
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
    include: { lines: true },
  });
  if (!pr) notFound();
  if (!canAccessPR(user, pr)) notFound();

  const requester = await prisma.user.findUnique({
    where: { id: pr.requestedById },
    include: { profile: { select: { fullName: true } } },
  });
  const approverName = await nameOf(pr.approvedById);

  const blanks = Math.max(0, MIN_ROWS - pr.lines.length);
  const approved = pr.status === "APPROVED" || pr.status === "ORDERED";

  return (
    <>
      {/* Isolate the document for printing regardless of the app shell. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pr-doc, #pr-doc * { visibility: visible !important; }
          #pr-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="mx-auto max-w-[850px] space-y-4">
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
          id="pr-doc"
          className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
        >
          {/* Form header / document control block */}
          <div className="flex items-start justify-between border-b-2 border-black pb-2">
            <div>
              <div className="text-lg font-bold tracking-tight">
                BECS Analytics
              </div>
              <div className="text-xl font-semibold">
                PURCHASE REQUISITION FORM
              </div>
            </div>
            <div className="text-right text-[11px] leading-5">
              <div>Doc #: BECS/FF/606/05</div>
              <div>Revision #: 02</div>
              <div>Issue #: 01</div>
              <div>Issue Date: 10.04.2025</div>
            </div>
          </div>

          {/* PR no + date */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              PR No: <span className="font-mono font-semibold">{pr.prNo}</span>
            </div>
            <div>Date: {formatDate(pr.createdAt)}</div>
          </div>

          {/* Item table */}
          <table className="mt-3 w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {[
                  ["Sr. #", "w-10"],
                  ["Name of item/services", ""],
                  ["Specification", ""],
                  ["Quantity", "w-20"],
                  ["Justification", ""],
                  ["Priority", "w-24"],
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
              {pr.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="border border-black px-2 py-1 text-center align-top">
                    {i + 1}
                  </td>
                  <td className="border border-black px-2 py-1 align-top">
                    {l.description}
                  </td>
                  <td className="border border-black px-2 py-1 align-top">
                    {l.specification ?? ""}
                  </td>
                  <td className="border border-black px-2 py-1 align-top">
                    {l.quantity}
                    {l.unit ? ` ${l.unit}` : ""}
                  </td>
                  <td className="border border-black px-2 py-1 align-top">
                    {l.justification ?? ""}
                  </td>
                  <td className="border border-black px-2 py-1 align-top">
                    {l.priority ?? ""}
                  </td>
                </tr>
              ))}
              {Array.from({ length: blanks }).map((_, i) => (
                <tr key={`b${i}`}>
                  <td className="border border-black px-2 py-1 text-center align-top">
                    {pr.lines.length + i + 1}
                  </td>
                  <td className="border border-black px-2 py-4" />
                  <td className="border border-black px-2 py-1" />
                  <td className="border border-black px-2 py-1" />
                  <td className="border border-black px-2 py-1" />
                  <td className="border border-black px-2 py-1" />
                </tr>
              ))}
            </tbody>
          </table>

          {pr.note && (
            <p className="mt-2 text-[12px]">
              <span className="font-semibold">Note:</span> {pr.note}
            </p>
          )}

          {/* Requester block */}
          <div className="mt-6 text-[13px] leading-7">
            <div>Signature ___________________</div>
            <div>
              Name{"      "}
              <span className="font-medium">
                {requester?.profile?.fullName ?? requester?.email ?? ""}
              </span>
            </div>
            <div>
              Designation{"  "}
              <span className="font-medium">
                {requester ? designationLabel(requester.designation) : ""}
              </span>
            </div>
          </div>

          {/* Approval section */}
          <div className="mt-6 border-t border-black pt-3 text-[12px]">
            <p className="font-medium">
              Purchase of the above items/services may be approved.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>Approval of Store In-charge: ______________</div>
                <div>Stock Available in Store: ______________</div>
                <div>Last Purchase Date: ______________</div>
              </div>
              <div className="space-y-3 text-right">
                <div className="font-semibold">
                  {approved ? "Approved" : "Approved / Not Approved"}
                </div>
                <div className="mt-8">
                  <div className="inline-block border-t border-black px-6 pt-1">
                    COO {approverName && `— ${approverName}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase branch */}
          <div className="mt-6 border-t border-black pt-3 text-[12px]">
            <p className="font-semibold">(FOR THE USE OF PURCHASE BRANCH)</p>
            <div className="mt-2 flex justify-between">
              <span>Indent No. _________________</span>
              <span>Date of receipt. _____________</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
