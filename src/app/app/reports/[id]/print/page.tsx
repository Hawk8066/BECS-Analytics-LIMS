import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAccessSample } from "@/lib/samples/access";
import { formatDate } from "@/lib/format";
import { limitText } from "@/lib/conformity";
import {
  letterheadFor,
  REPORT_NOTES,
  DECISION_RULE,
  DOC_CONTROL,
} from "@/lib/report/letterhead";
import { PrintButton } from "./print-button";

// Blank the document title so the browser's print header (which prints
// document.title) doesn't stamp "BECS Analytics LIMS" across the top.
export const metadata = { title: " " };

// One right-aligned "Label   value" line in the sample-reference block.
function RefLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-end gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-[90px] text-left font-medium">{value || "—"}</span>
    </div>
  );
}

export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const report = await prisma.finalReport.findUnique({
    where: { id },
    include: {
      sample: {
        include: {
          parameters: {
            include: { parameter: true, testMethod: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
          standard: { select: { name: true } },
        },
      },
    },
  });
  if (!report) notFound();
  const sample = report.sample;
  if (!canAccessSample(user, sample)) notFound();

  // The printed report is the decoded deliverable (client identity is revealed
  // at approval), so it always shows the client — unlike the blinded testing
  // views. Access is still gated by canAccessSample above.
  const [client, facility, signatures] = await Promise.all([
    prisma.client.findUnique({
      where: { id: sample.clientId },
      select: {
        company: true,
        addressLine1: true,
        addressLine2: true,
        addressLine3: true,
        city: true,
        province: true,
        country: true,
        contactPerson: true,
        contactNumber: true,
      },
    }),
    prisma.facility.findUnique({
      where: { id: sample.facilityId },
      select: { code: true },
    }),
    prisma.signature.findMany({
      where: { subjectType: "Sample", subjectId: sample.id },
      select: { signerId: true, meaning: true },
    }),
  ]);

  // Signer names for the signature block (verified → OM, approved → COO).
  const signerIds = [...new Set(signatures.map((s) => s.signerId).filter(Boolean))] as string[];
  const signers = signerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: signerIds } },
        select: { id: true, email: true, profile: { select: { fullName: true } } },
      })
    : [];
  const nameById = new Map(
    signers.map((u) => [u.id, u.profile?.fullName ?? u.email]),
  );
  const signerName = (meaning: string) => {
    const sig = signatures.find((s) => s.meaning === meaning);
    return sig?.signerId ? nameById.get(sig.signerId) ?? null : null;
  };

  const lh = letterheadFor(facility?.code);
  const conformed = !!sample.standardId;

  // "Sample tested" = latest result entry; falls back to the approval date.
  const testedAt =
    sample.parameters
      .map((p) => p.enteredAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? report.approvedAt;

  const clientAddress = client
    ? ([
        client.addressLine1,
        client.addressLine2,
        client.addressLine3,
        [client.city, client.province, client.country].filter(Boolean).join(", "),
      ].filter(Boolean) as string[])
    : [];
  const issuedTo = sample.thirdPartyName ?? client?.company ?? "—";

  return (
    <>
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>

      <div className="mx-auto max-w-[850px] space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/app/reports/${report.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back to report
          </Link>
          <PrintButton />
        </div>

        <div
          id="report-doc"
          className="bg-white p-8 text-[12px] text-black shadow-sm print:p-0 print:shadow-none"
        >
          {/* Masthead */}
          <div className="flex items-start justify-between">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/becs-br.png"
                alt="BECS Analytics"
                className="h-14 w-auto object-contain"
              />
              <div className="mt-1 text-[11px]">NTN : {lh.ntn}</div>
            </div>
            <div className="pt-1 text-center">
              <div className="text-2xl font-bold tracking-wide">{lh.name}</div>
              {lh.addressLines.map((l, i) => (
                <div key={i} className="text-[11px] text-neutral-600">
                  {l}
                </div>
              ))}
            </div>
            {/* Combined PNAC + LAB 316 / 17025 accreditation mark, sized wide so
                the box border stays crisp (the 1500×500 source downscales cleanly). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/accreditation.png"
              alt="PNAC — Pakistan National Accreditation Council · LAB 316 · ISO 17025"
              className="h-auto w-56 shrink-0 object-contain"
            />
          </div>

          <h1 className="mt-4 text-center text-xl font-bold">Test Report</h1>

          {/* Client + sample reference */}
          <div className="mt-4 flex justify-between gap-8">
            <div className="max-w-[55%]">
              <div className="font-semibold">{issuedTo}</div>
              {clientAddress.map((l, i) => (
                <div key={i} className="text-neutral-700">
                  {l}
                </div>
              ))}
              {client?.contactPerson && (
                <div className="mt-3">
                  <div className="font-semibold">Client&apos;s Focal Person</div>
                  <div className="text-neutral-700">{client.contactPerson}</div>
                  {client.contactNumber && (
                    <div className="text-neutral-700">{client.contactNumber}</div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <RefLine label="Report No" value={report.reportNo} />
              <RefLine label="Lab ID" value={sample.labId} />
              <RefLine label="Report Date" value={formatDate(report.approvedAt)} />
              <RefLine label="Sample Tested" value={formatDate(testedAt)} />
              <RefLine label="Sample Received" value={formatDate(sample.createdAt)} />
              <div className="pt-2 text-right font-semibold">Sample Reference</div>
              <RefLine label="Client's ID" value={sample.clientSampleRef ?? ""} />
              <RefLine label="Material" value={sample.sampleType} />
              <RefLine label="Quantity" value={sample.quantity ?? ""} />
              <RefLine label="Physical Condition" value={sample.physicalCondition ?? ""} />
            </div>
          </div>

          {/* Environmental conditions */}
          <div className="mt-4 flex justify-between border-t border-neutral-300 pt-2 text-[11px]">
            <span className="font-medium text-neutral-700">
              Environmental conditions while performing test
            </span>
            <span>
              Temperature : {lh.environmental.temperature}; Humidity :{" "}
              {lh.environmental.humidity}
            </span>
          </div>

          {/* Results */}
          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr className="border-y border-black bg-neutral-100">
                <th className="px-2 py-1 text-left font-semibold">Sr #</th>
                <th className="px-2 py-1 text-left font-semibold">Parameter</th>
                <th className="px-2 py-1 text-left font-semibold">Test Method</th>
                <th className="px-2 py-1 text-left font-semibold">Test Result</th>
                <th className="px-2 py-1 text-left font-semibold">Unit</th>
                {conformed && (
                  <>
                    <th className="px-2 py-1 text-left font-semibold">Limit</th>
                    <th className="px-2 py-1 text-left font-semibold">Remarks</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sample.parameters.map((sp, i) => (
                <tr key={sp.id} className="border-b border-neutral-300 align-top">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">{sp.parameter.name}</td>
                  <td className="px-2 py-1 text-neutral-700">
                    {sp.testMethod?.name || sp.parameter.method || "—"}
                  </td>
                  <td className="px-2 py-1">{sp.resultValue || "—"}</td>
                  <td className="px-2 py-1 text-neutral-700">
                    {sp.unit || sp.parameter.unit || "—"}
                  </td>
                  {conformed && (
                    <>
                      <td className="px-2 py-1 text-neutral-700">
                        {limitText(sp.limitMin, sp.limitMax, sp.unit || sp.parameter.unit) || "—"}
                      </td>
                      <td className="px-2 py-1">
                        {sp.conformity === "CONFORM"
                          ? "PASS"
                          : sp.conformity === "NON_CONFORM"
                            ? "FAIL"
                            : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-3 text-center text-[11px] font-semibold text-neutral-600">
            — End of Test Results —
          </div>

          {conformed && sample.standard && (
            <p className="text-[11px]">
              <span className="font-semibold">Conformity:</span> assessed against{" "}
              {sample.standard.name} on the client&apos;s request.
            </p>
          )}

          {/* Notes */}
          <div className="mt-4 text-[10.5px] leading-snug">
            <div className="font-semibold">Notes :</div>
            <ol className="ml-5 list-decimal space-y-0.5">
              {REPORT_NOTES.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ol>
            <p className="mt-1">
              <span className="font-semibold">Decision rule:</span> {DECISION_RULE}
            </p>
          </div>

          {/* Signatures */}
          <div className="mt-10 flex items-end justify-between text-center text-[11px]">
            <div className="w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sign-om.jpg"
                alt="Operations Manager signature"
                className="mx-auto h-12 w-auto object-contain"
              />
              <div className="border-t border-black pt-1 font-semibold">
                Operations Manager
              </div>
              {signerName("verified") && (
                <div className="text-neutral-600">{signerName("verified")}</div>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/becs-stamp.png"
              alt="BECS Analytics Lahore stamp"
              className="h-24 w-24 object-contain"
            />
            <div className="w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sign-coo.png"
                alt="Chief Operating Officer signature"
                className="mx-auto h-12 w-auto object-contain"
              />
              <div className="border-t border-black pt-1 font-semibold">
                Chief Operating Officer
              </div>
              {signerName("approved") && (
                <div className="text-neutral-600">{signerName("approved")}</div>
              )}
            </div>
          </div>

          {/* Controlled-document footer — pinned to the bottom of the page in print. */}
          <div className="mt-8 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500 print:fixed print:inset-x-0 print:bottom-0 print:mt-0">
            {DOC_CONTROL}
          </div>
        </div>
      </div>
    </>
  );
}
