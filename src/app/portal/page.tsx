import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function PortalHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "CLIENT" || !user.clientId) redirect("/app");

  const [client, samples] = await Promise.all([
    prisma.client.findUnique({ where: { id: user.clientId } }),
    prisma.sample.findMany({
      where: { clientId: user.clientId },
      include: { report: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!client) redirect("/login");

  const address = [
    client.addressLine1,
    client.addressLine2,
    client.addressLine3,
    [client.city, client.province, client.country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {client.company}</h1>
        <p className="text-sm text-muted-foreground">
          Your account details, samples and reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My details</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Client No" value={client.clientNo} />
          <Field label="Company" value={client.company} />
          <Field label="Sector" value={client.sector} />
          <Field label="Contact person" value={client.contactPerson} />
          <Field label="Contact number" value={client.contactNumber} />
          <Field label="Email" value={client.email} />
          <Field label="NTN" value={client.ntn} />
          <Field label="STN" value={client.stn} />
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
            <span className="text-muted-foreground">Address</span>
            <span className="whitespace-pre-line">{address || "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My samples</CardTitle>
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
