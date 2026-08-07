import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { canAccessSample } from "@/lib/samples/access";
import { formatDateTime } from "@/lib/format";
import { limitText } from "@/lib/conformity";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportPage({
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
            include: {
              parameter: true,
              outsourceLab: { select: { name: true, labNo: true } },
            },
          },
          standard: { select: { name: true } },
          thirdParty: { select: { company: true } },
        },
      },
    },
  });
  if (!report) notFound();

  const sample = report.sample;
  if (!canAccessSample(user, sample)) notFound();
  // Subcontracted (outsourced) parameters, disclosed on the internal report.
  const outsourced = sample.parameters.filter((p) => p.outsourceLabId);

  // On-request conformity: whether this sample was judged against a standard,
  // and whether every judged result conforms.
  const conformed = !!sample.standardId;
  const judged = sample.parameters.filter((p) => p.conformity != null);
  const overallConforms =
    conformed && judged.length > 0 && judged.every((p) => p.conformity === "CONFORM");

  // Decoded for the LO; coded for everyone else (SSOT §8).
  const seeClient = canSeeClientIdentity(user.designation);
  const client = seeClient
    ? await prisma.client.findUnique({
        where: { id: sample.clientId },
        select: { company: true, clientNo: true },
      })
    : null;

  const qrDataUrl = await QRCode.toDataURL(report.qrText, {
    width: 140,
    margin: 1,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/app/samples/${sample.id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to sample
        </Link>
        <Link
          href={`/app/reports/${report.id}/print`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Print / Save as PDF
        </Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg">Test Report</CardTitle>
            <p className="font-mono text-sm text-muted-foreground">
              {report.reportNo}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="report QR code" width={96} height={96} />
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Lab ID</span>
            <span className="font-mono">{sample.labId}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Sample type</span>
            <span>{sample.sampleType}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Issued to</span>
            <span>
              {(sample.thirdParty?.company ?? sample.thirdPartyName) ? (
                sample.thirdParty?.company ?? sample.thirdPartyName
              ) : seeClient ? (
                client ? (
                  `${client.company} (${client.clientNo})`
                ) : (
                  "—"
                )
              ) : (
                <span className="text-muted-foreground">••••• (blinded)</span>
              )}
            </span>
          </div>
          {conformed && sample.standard && (
            <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
              <span className="text-muted-foreground">Conformed to</span>
              <span>{sample.standard.name}</span>
            </div>
          )}
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Approved</span>
            <span>{formatDateTime(report.approvedAt)}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Seal (SHA-256)</span>
            <span className="break-all font-mono text-xs">
              {report.contentHash}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Results</CardTitle>
          {conformed && (
            <Badge variant={overallConforms ? "default" : "destructive"}>
              {overallConforms ? "PASS" : "FAIL"}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Result</TableHead>
                {conformed && <TableHead>Limit</TableHead>}
                {conformed && <TableHead>Conformity</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.parameters.map((sp) => (
                <TableRow key={sp.id}>
                  <TableCell>
                    {sp.parameter.name}
                    {sp.outsourceLabId && (
                      <sup className="ml-0.5 text-muted-foreground">†</sup>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.unit || sp.parameter.unit || "—"}
                  </TableCell>
                  <TableCell>{sp.resultValue || "—"}</TableCell>
                  {conformed && (
                    <TableCell className="text-muted-foreground">
                      {limitText(sp.limitMin, sp.limitMax, sp.unit || sp.parameter.unit) || "—"}
                    </TableCell>
                  )}
                  {conformed && (
                    <TableCell>
                      {sp.conformity === "CONFORM" ? (
                        <Badge>PASS</Badge>
                      ) : sp.conformity === "NON_CONFORM" ? (
                        <Badge variant="destructive">FAIL</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {outsourced.length > 0 && (
            <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              <span className="mr-1">†</span>
              Subcontracted to an external laboratory:{" "}
              {[
                ...new Set(
                  outsourced.map(
                    (p) => `${p.outsourceLab?.name} (${p.outsourceLab?.labNo})`,
                  ),
                ),
              ].join(", ")}
              .
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
