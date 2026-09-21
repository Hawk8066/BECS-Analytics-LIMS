import Link from "next/link";
import { formatDate } from "@/lib/format";
import { clientSamples, requireClient } from "@/lib/portal/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Internal workflow states are collapsed for the client: they care whether the
// work is done, not which desk it is on.
const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  ASSIGNED: "In progress",
  RESULTS_ENTERED: "In progress",
  VERIFIED: "Under review",
  APPROVED: "Approved",
  REPORTED: "Reported",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  REGISTERED: "outline",
  ASSIGNED: "secondary",
  RESULTS_ENTERED: "secondary",
  VERIFIED: "secondary",
  APPROVED: "default",
  REPORTED: "default",
};

export default async function PortalSamplesPage() {
  const { clientId } = await requireClient();
  const samples = await clientSamples(clientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My samples</h1>
        <p className="text-sm text-muted-foreground">
          Everything booked with BECS, and the report once it is issued.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {samples.length} sample{samples.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.labId}</TableCell>
                    <TableCell>{s.sampleType}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.report ? (
                        <Link
                          href={`/portal/reports/${s.report.id}`}
                          className="text-sm underline"
                        >
                          {s.report.reportNo}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not ready
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {samples.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No samples booked yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
