import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { limitText } from "@/lib/conformity";
import { ReportDocument } from "@/components/report/report-document";
import { PrintButton } from "@/components/print-button";

// Blank the tab title so the browser print header doesn't stamp it.
export const metadata = { title: " " };

export default async function PortalReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "CLIENT" || !user.clientId) redirect("/app");

  const { id } = await params;
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
          thirdParty: true,
        },
      },
    },
  });
  // A client may only print a report for their own sample.
  if (!report || report.sample.clientId !== user.clientId) notFound();
  const sample = report.sample;

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

  const signerIds = [
    ...new Set(signatures.map((s) => s.signerId).filter(Boolean)),
  ] as string[];
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

  const conformed = !!sample.standardId;
  const testedAt =
    sample.parameters
      .map((p) => p.enteredAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? report.approvedAt;

  const tp = sample.thirdParty;
  const addrSource = tp ?? client ?? null;
  const issuedAddress = addrSource
    ? ([
        addrSource.addressLine1,
        addrSource.addressLine2,
        addrSource.addressLine3,
        [addrSource.city, addrSource.province, addrSource.country]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean) as string[])
    : [];
  const issuedTo = tp?.company ?? sample.thirdPartyName ?? client?.company ?? "—";

  const reportParams = sample.parameters.map((sp) => ({
    id: sp.id,
    name: sp.parameter.name,
    method: sp.testMethod?.name || sp.parameter.method || "—",
    resultValue: sp.resultValue || "—",
    unit: sp.unit || sp.parameter.unit || "—",
    limit:
      limitText(sp.limitMin, sp.limitMax, sp.unit || sp.parameter.unit) || "—",
    conformity: sp.conformity,
  }));

  return (
    <>
      {/* Print just the report, isolated from the portal header/nav. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-doc, #report-doc * { visibility: visible !important; }
          #report-doc { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/portal/reports/${report.id}`}
            className="text-sm text-muted-foreground underline"
          >
            ← Back
          </Link>
          <PrintButton />
        </div>

        <ReportDocument
          data={{
            facilityCode: facility?.code,
            reportNo: report.reportNo,
            approvedAt: report.approvedAt,
            testedAt,
            receivedAt: sample.createdAt,
            labId: sample.labId,
            sampleType: sample.sampleType,
            clientSampleRef: sample.clientSampleRef,
            quantity: sample.quantity,
            physicalCondition: sample.physicalCondition,
            conformed,
            standardName: sample.standard?.name ?? null,
            issuedTo,
            issuedAddress,
            focalPerson: tp?.contactPerson ?? client?.contactPerson ?? null,
            focalNumber: tp?.contactNumber ?? client?.contactNumber ?? null,
            isThirdParty: !!tp,
            parameters: reportParams,
            verifiedName: signerName("verified"),
            approvedName: signerName("approved"),
          }}
        />
      </div>
    </>
  );
}
