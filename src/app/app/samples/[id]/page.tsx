import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
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

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const sample = await prisma.sample.findUnique({
    where: { id },
    include: {
      parameters: { include: { parameter: true, testMethod: true } },
    },
  });
  if (!sample) notFound();

  // Enforce facility/section scope for non-senior roles.
  if (
    !user.canReadCrossSection &&
    (sample.facilityId !== user.facilityId || sample.sectionId !== user.sectionId)
  ) {
    notFound();
  }

  const seeClient = canSeeClientIdentity(user.designation);
  const client = seeClient
    ? await prisma.client.findUnique({
        where: { id: sample.clientId },
        select: { company: true, clientNo: true },
      })
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{sample.labId}</h1>
          <p className="text-sm text-muted-foreground">{sample.sampleType}</p>
        </div>
        <Badge>{sample.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Client</span>
            <span>
              {seeClient ? (
                client ? (
                  `${client.company} (${client.clientNo})`
                ) : (
                  "—"
                )
              ) : (
                <span className="text-muted-foreground">
                  ••••• (blinded — decoded after COO approval)
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Client sample ref</span>
            <span>{sample.clientSampleRef || "—"}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Priority</span>
            <span>{sample.priority || "—"}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Instructions</span>
            <span>{sample.instructions || "—"}</span>
          </div>
          {sample.thirdPartyName && (
            <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
              <span className="text-muted-foreground">Third-party name</span>
              <span>{sample.thirdPartyName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.parameters.map((sp) => (
                <TableRow key={sp.id}>
                  <TableCell>{sp.parameter.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.parameter.unit || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.testMethod?.code || "—"}
                  </TableCell>
                  <TableCell>{sp.resultValue || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
