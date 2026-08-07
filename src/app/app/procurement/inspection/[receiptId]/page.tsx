import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAccessPR } from "@/lib/procurement/access";
import { formatDate } from "@/lib/format";
import { designationLabel } from "@/lib/labels";
import { PrintButton } from "../../[id]/print/print-button";

// One boxed option; the chosen answer is filled black.
function box(label: string, active: boolean) {
  return (
    <span
      className={`inline-block min-w-[48px] border border-black px-2 py-0.5 text-center ${
        active ? "bg-black font-semibold text-white" : ""
      }`}
    >
      {label}
    </span>
  );
}
function yesNo(a: string | null, applicable?: boolean) {
  return (
    <span className="inline-flex gap-2">
      {box("Yes", a === "YES")}
      {box("No", a === "NO")}
      {applicable ? box("N/A", a === "NA") : null}
    </span>
  );
}
function okExpired(a: string | null) {
  return (
    <span className="inline-flex gap-2">
      {box("OK", a === "OK")}
      {box("Expired", a === "EXPIRED")}
      {box("N/A", a === "NA")}
    </span>
  );
}
function row(label: string, node: React.ReactNode) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-[12px]">
      <span>{label}</span>
      <span className="shrink-0">{node}</span>
    </div>
  );
}

export default async function InspectionPrintPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id: receiptId },
    include: {
      inspection: true,
      po: { include: { vendor: true, pr: true } },
    },
  });
  if (!receipt || !receipt.inspection) notFound();
  if (!canAccessPR(user, receipt.po.pr)) notFound();

  const insp = receipt.inspection;
  const inspector = insp.inspectedById
    ? await prisma.user.findUnique({
        where: { id: insp.inspectedById },
        include: { profile: { select: { fullName: true } } },
      })
    : null;
  const inspectorName = inspector?.profile?.fullName ?? inspector?.email ?? "";
  const inspectorLine = inspector
    ? `${inspectorName} — ${designationLabel(inspector.designation)}`
    : "";
  const supplier = insp.supplier ?? receipt.po.vendor?.company ?? "";

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #insp-doc, #insp-doc * { visibility: visible !important; }
          #insp-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="mx-auto max-w-[850px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/procurement/${receipt.po.prId}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to request
          </Link>
          <PrintButton />
        </div>

        <div
          id="insp-doc"
          className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-2">
            <div className="max-w-[62%]">
              <div className="text-lg font-bold tracking-tight">
                BECS Analytics
              </div>
              <div className="text-base font-semibold uppercase">
                Incoming Inspection Checklist (Equipment and Material)
              </div>
            </div>
            <div className="text-right text-[11px] leading-5">
              <div>BECS/FF/606/09</div>
              <div>Revision #: 00</div>
              <div>Issue #: 01</div>
              <div>Issue Date: 01.01.2023</div>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 space-y-1 text-[12px]">
            <div>
              Name and Designation of Indenter / store officer:{" "}
              <span className="font-medium">{inspectorLine || "—"}</span>
            </div>
            <div>
              Name of Supplier:{" "}
              <span className="font-medium">{supplier || "—"}</span>
            </div>
            <div>
              Purchase requisition No.:{" "}
              <span className="font-mono">{receipt.po.pr.prNo}</span>
            </div>
            <div>
              Decision:{" "}
              <span
                className={`font-semibold ${
                  insp.decision === "ACCEPTED"
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {insp.decision}
              </span>
            </div>
          </div>

          {/* Chemicals */}
          <div className="mt-4">
            <div className="text-[13px] font-bold">
              CHEMICALS:{" "}
              <span className="font-normal underline">
                {insp.chemicalItems || "—"}
              </span>
            </div>
            <div className="mt-1 divide-y border-t">
              {row("Check specifications as per the order", yesNo(insp.chemSpecs))}
              {row("Check quantity as per order", yesNo(insp.chemQuantity))}
              {row("Check proper packing", yesNo(insp.chemPacking))}
              {row(
                "Check expiry date (where applicable)",
                okExpired(insp.chemExpiry),
              )}
              {row(
                "Manufacturer's storage instructions complied (where applicable)",
                yesNo(insp.chemStorage, true),
              )}
            </div>
          </div>

          {/* Equipment */}
          <div className="mt-4">
            <div className="text-[13px] font-bold">
              EQUIPMENT:{" "}
              <span className="font-normal underline">
                {insp.equipmentItems || "—"}
              </span>
            </div>
            <div className="mt-1 divide-y border-t">
              {row("Check specifications as per the order", yesNo(insp.equipSpecs))}
              {row("Check proper packing", yesNo(insp.equipPacking))}
            </div>
          </div>

          {/* Material */}
          <div className="mt-4">
            <div className="text-[13px] font-bold">
              MATERIAL:{" "}
              <span className="font-normal underline">
                {insp.materialItems || "—"}
              </span>
            </div>
            <div className="mt-1 divide-y border-t">
              {row("Check specifications as per the order", yesNo(insp.matSpecs))}
              {row("Check quantity as per order", yesNo(insp.matQuantity))}
            </div>
          </div>

          {insp.notes && (
            <p className="mt-4 text-[12px]">
              <span className="font-semibold">Notes:</span> {insp.notes}
            </p>
          )}

          {/* Signatures */}
          <div className="mt-12 flex items-end justify-between text-[12px]">
            <div>
              Indenter:{" "}
              <span className="inline-block min-w-[160px] border-b border-black" />
            </div>
            <div>
              Store Officer:{" "}
              <span className="font-medium">{inspectorName}</span>
            </div>
          </div>
          <div className="mt-4 text-[12px]">
            Date: {formatDate(insp.createdAt)}
          </div>
        </div>
      </div>
    </>
  );
}
