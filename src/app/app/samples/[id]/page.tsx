import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { canAccessSample } from "@/lib/samples/access";
import {
  canApproveSample,
  canCoordinateTesting,
} from "@/lib/auth/perms";
import {
  approveSample,
  assignSample,
  submitForVerification,
  verifySample,
} from "@/lib/actions/testing";
import { ResultEntryForm } from "./result-entry-form";
import { Button, buttonVariants } from "@/components/ui/button";
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
      report: true,
    },
  });
  if (!sample) notFound();
  if (!canAccessSample(user, sample)) notFound();

  const seeClient = canSeeClientIdentity(user.designation);
  const [client, assignedAnalyst, analysts] = await Promise.all([
    seeClient
      ? prisma.client.findUnique({
          where: { id: sample.clientId },
          select: { company: true, clientNo: true },
        })
      : Promise.resolve(null),
    sample.assignedToId
      ? prisma.user.findUnique({
          where: { id: sample.assignedToId },
          include: { profile: { select: { fullName: true } } },
        })
      : Promise.resolve(null),
    sample.status === "REGISTERED" && canCoordinateTesting(user.designation)
      ? prisma.user.findMany({
          where: {
            designation: "ANALYST",
            status: "ACTIVE",
            facilityId: sample.facilityId,
          },
          include: { profile: { select: { fullName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const coordinator = canCoordinateTesting(user.designation);
  const isAnalyst = sample.assignedToId === user.id;
  const allEntered = sample.parameters.every((p) => p.resultValue);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{sample.labId}</h1>
          <p className="text-sm text-muted-foreground">
            {sample.sampleType}
            {assignedAnalyst &&
              ` · analyst: ${assignedAnalyst.profile?.fullName ?? assignedAnalyst.email}`}
          </p>
        </div>
        <Badge>{sample.status}</Badge>
      </div>

      {/* Workflow panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sample.status === "REGISTERED" &&
            (coordinator ? (
              <form action={assignSample} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="sampleId" value={sample.id} />
                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">
                    Assign to analyst
                  </label>
                  <select
                    name="analystId"
                    required
                    defaultValue=""
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {analysts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.profile?.fullName ?? a.email}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" type="submit">
                  Assign
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Awaiting assignment.</p>
            ))}

          {sample.status === "ASSIGNED" &&
            (isAnalyst ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter a result and upload the raw-data photo for each parameter.
                </p>
                {sample.parameters.map((sp) => (
                  <ResultEntryForm
                    key={sp.id}
                    sampleParameterId={sp.id}
                    parameterName={sp.parameter.name}
                    hasResult={!!sp.resultValue}
                  />
                ))}
                {allEntered && (
                  <form action={submitForVerification}>
                    <input type="hidden" name="sampleId" value={sample.id} />
                    <Button type="submit">Submit for verification</Button>
                  </form>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Assigned — results in progress.
              </p>
            ))}

          {sample.status === "RESULTS_ENTERED" &&
            (coordinator && !isAnalyst ? (
              <form action={verifySample}>
                <input type="hidden" name="sampleId" value={sample.id} />
                <Button type="submit">Verify results</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Awaiting verification.
              </p>
            ))}

          {sample.status === "VERIFIED" &&
            (canApproveSample(user.designation) ? (
              <form action={approveSample}>
                <input type="hidden" name="sampleId" value={sample.id} />
                <Button type="submit">Approve &amp; generate report (COO)</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Awaiting COO approval.
              </p>
            ))}

          {sample.status === "REPORTED" && sample.report && (
            <div className="flex items-center gap-3">
              <span className="text-sm">
                Report{" "}
                <span className="font-mono">{sample.report.reportNo}</span> issued.
              </span>
              <Link
                href={`/app/reports/${sample.report.id}`}
                className={buttonVariants({ size: "sm" })}
              >
                View report
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parameters &amp; results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Raw data</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.parameters.map((sp) => (
                <TableRow key={sp.id}>
                  <TableCell>
                    {sp.parameter.name}
                    {sp.parameter.unit && (
                      <span className="text-muted-foreground"> ({sp.parameter.unit})</span>
                    )}
                  </TableCell>
                  <TableCell>{sp.resultValue || "—"}</TableCell>
                  <TableCell>
                    {sp.rawDataAttachmentId ? (
                      <a
                        href={`/api/files/${sp.rawDataAttachmentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1ca9e6] hover:underline"
                      >
                        photo
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
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
