import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canAccessPR } from "@/lib/procurement/access";
import { letterheadFor } from "@/lib/report/letterhead";
import { designationLabel } from "@/lib/labels";
import { PrintButton } from "@/components/print-button";

// The printed pass is the paper that travels with the instrument, so it stands
// alone: what left, whose it is, where it went, when it is due back, and the
// signatures that let it through the gate and book it back in.
export const metadata = { title: " " };

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function SignatureLine({ role, name }: { role: string; name?: string }) {
  return (
    <div className="pt-8">
      <div className="border-t border-black pt-1 text-[11px]">
        {role}
        {name ? ` — ${name}` : ""}
      </div>
      <div className="text-[10px] text-neutral-500">Name / signature / date</div>
    </div>
  );
}

export default async function GatePassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const pass = await prisma.gatePass.findUnique({
    where: { id },
    include: {
      equipment: {
        select: {
          assetTag: true,
          name: true,
          make: true,
          model: true,
          serialNo: true,
          location: true,
        },
      },
      repair: {
        select: {
          id: true,
          repairNo: true,
          reason: true,
          pr: { select: { prNo: true, pos: { select: { poNo: true } } } },
        },
      },
      vendor: {
        select: { company: true, address: true, contactNumber: true, vendorNo: true },
      },
    },
  });
  if (!pass) notFound();
  if (!canAccessPR(user, pass)) notFound();

  const facility = await prisma.facility.findUnique({
    where: { id: pass.facilityId },
    select: { code: true },
  });
  const head = letterheadFor(facility?.code ?? "LAHORE");
  const issuer = pass.issuedById
    ? await prisma.user.findUnique({
        where: { id: pass.issuedById },
        select: { designation: true, profile: { select: { fullName: true } } },
      })
    : null;
  const poNo = pass.repair.pr.pos[0]?.poNo;

  return (
    <>
      <style>{`@media print { @page { size: A4; margin: 16mm; } }`}</style>
      <div className="mx-auto max-w-[850px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/equipment/repairs/${pass.repair.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to {pass.repair.repairNo}
          </Link>
          <PrintButton />
        </div>

        <div
          id="gate-pass-doc"
          className="rounded-md border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
        >
          <div className="flex items-start justify-between border-b-2 border-black pb-2">
            <div>
              <div className="text-lg font-bold tracking-tight">{head.name}</div>
              <div className="text-[11px] leading-4 text-neutral-600">
                {head.addressLines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
              <div className="mt-1 text-xl font-semibold">EQUIPMENT GATE PASS</div>
            </div>
            <div className="text-right text-[11px] leading-5">
              <div>Doc #: BECS/FF/606/__</div>
              <div>Revision #: 01</div>
              <div>Issue #: 01</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <Field
              label="Gate Pass No"
              value={<span className="font-mono font-semibold">{pass.gatePassNo}</span>}
            />
            <Field label="Date of despatch" value={formatDate(pass.outDate)} />
            <Field
              label="Expected return"
              value={pass.expectedReturnDate ? formatDate(pass.expectedReturnDate) : "—"}
            />
          </div>

          <div className="mt-5 text-[11px] font-semibold uppercase tracking-wide">
            Equipment released
          </div>
          <table className="mt-1 w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="w-40 border border-black px-2 py-1 text-[11px] text-neutral-600">
                  Asset tag
                </td>
                <td className="border border-black px-2 py-1 font-mono">
                  {pass.equipment.assetTag}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-[11px] text-neutral-600">
                  Description
                </td>
                <td className="border border-black px-2 py-1">
                  {pass.equipment.name}
                  {pass.equipment.make || pass.equipment.model
                    ? ` · ${[pass.equipment.make, pass.equipment.model].filter(Boolean).join(" ")}`
                    : ""}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-[11px] text-neutral-600">
                  Serial number
                </td>
                <td className="border border-black px-2 py-1">
                  {pass.equipment.serialNo ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-[11px] text-neutral-600">
                  Accessories
                </td>
                <td className="border border-black px-2 py-1">
                  {pass.accessories ?? "None"}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-[11px] text-neutral-600">
                  Purpose
                </td>
                <td className="border border-black px-2 py-1">
                  {pass.purpose ?? pass.repair.reason}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-5 grid grid-cols-2 gap-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide">
                Released to
              </div>
              <div className="mt-1 text-sm">
                <div className="font-medium">
                  {pass.vendorName ?? pass.vendor?.company ?? "—"}
                </div>
                {pass.vendor?.address && (
                  <div className="text-[11px] text-neutral-600">
                    {pass.vendor.address}
                  </div>
                )}
                {pass.vendor?.contactNumber && (
                  <div className="text-[11px] text-neutral-600">
                    {pass.vendor.contactNumber}
                  </div>
                )}
                {pass.vendor?.vendorNo && (
                  <div className="font-mono text-[11px] text-neutral-600">
                    {pass.vendor.vendorNo}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide">
                Reference
              </div>
              <div className="mt-1 space-y-0.5 text-sm">
                <div>
                  Repair:{" "}
                  <span className="font-mono">{pass.repair.repairNo}</span>
                </div>
                <div>
                  Requisition:{" "}
                  <span className="font-mono">{pass.repair.pr.prNo}</span>
                </div>
                <div>
                  Purchase order:{" "}
                  <span className="font-mono">{poNo ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-6">
            <SignatureLine
              role="Issued by"
              name={
                issuer
                  ? `${issuer.profile?.fullName ?? ""} (${designationLabel(issuer.designation)})`.trim()
                  : undefined
              }
            />
            <SignatureLine role="Received by (vendor representative)" />
            <SignatureLine role="Security / gate check" />
          </div>

          <div className="mt-6 border-t-2 border-black pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide">
              Return — to be completed when the equipment comes back
            </div>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <Field
                label="Date returned"
                value={
                  pass.actualReturnDate ? formatDate(pass.actualReturnDate) : "____________"
                }
              />
              <Field
                label="Status"
                value={pass.status === "RETURNED" ? "Returned" : "Out"}
              />
              <Field label="Condition on return" value="____________" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <SignatureLine role="Received back by (Store In-charge / OM)" />
              <SignatureLine role="Checked by" />
            </div>
          </div>

          <p className="mt-6 text-[10px] text-neutral-500">
            This pass authorises the equipment described above to leave the
            premises for the stated purpose only. It must be presented at the
            gate on the way out and again on return.
          </p>
        </div>
      </div>
    </>
  );
}
