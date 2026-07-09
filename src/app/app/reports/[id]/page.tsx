import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { canAccessSample } from "@/lib/samples/access";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
        include: { parameters: { include: { parameter: true } } },
      },
    },
  });
  if (!report) notFound();

  const sample = report.sample;
  if (!canAccessSample(user, sample)) notFound();

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
              {sample.thirdPartyName ? (
                sample.thirdPartyName
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
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.parameters.map((sp) => (
                <TableRow key={sp.id}>
                  <TableCell>{sp.parameter.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.unit || sp.parameter.unit || "—"}
                  </TableCell>
                  <TableCell>{sp.resultValue || "—"}</TableCell>
                  <TableCell>
                    {sp.outOfCalibration && (
                      <Badge variant="destructive">out-of-cal</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
