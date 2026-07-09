import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PortalReportPage({
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
        include: { parameters: { include: { parameter: true } } },
      },
    },
  });
  // A client may only view a report for their own sample.
  if (!report || report.sample.clientId !== user.clientId) notFound();

  const s = report.sample;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="text-sm underline">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Report {report.reportNo}</h1>
        <p className="text-sm text-muted-foreground">
          Approved {formatDateTime(report.approvedAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sample</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Lab ID</span>
            <span className="font-mono">{s.labId}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Sample type</span>
            <span>{s.sampleType}</span>
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
                <TableHead>Result</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.parameters.map((sp) => (
                <TableRow key={sp.id}>
                  <TableCell>{sp.parameter.name}</TableCell>
                  <TableCell className="font-medium">{sp.resultValue ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.unit ?? sp.parameter.unit ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Document ref: {report.qrText}
      </p>
    </div>
  );
}
