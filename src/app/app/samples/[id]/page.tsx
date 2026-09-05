import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { canAccessSample } from "@/lib/samples/access";
import { priorityLabel } from "@/lib/pricing";
import { limitText } from "@/lib/conformity";
import {
  canApproveSample,
  canCoordinateTesting,
  ANALYST_DESIGNATIONS,
} from "@/lib/auth/perms";
import { approveSample, verifySample } from "@/lib/actions/testing";
import { ResultEntryForm } from "./result-entry-form";
import { AssignPanel } from "./assign-panel";
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
      standard: { select: { name: true } },
    },
  });
  if (!sample) notFound();
  if (!canAccessSample(user, sample)) notFound();

  const seeClient = canSeeClientIdentity(user.designation);
  const coordinator = canCoordinateTesting(user.designation);
  // Coordinators can (re)assign while the sample is still being set up.
  const canAssign =
    coordinator && (sample.status === "REGISTERED" || sample.status === "ASSIGNED");
  // Distinct analysts already assigned across this sample's parameters.
  const assignedIds = [
    ...new Set(
      sample.parameters
        .map((p) => p.assignedToId)
        .filter((x): x is string => !!x),
    ),
  ];
  // Distinct outsource labs already assigned across this sample's parameters.
  const outsourceLabIds = [
    ...new Set(
      sample.parameters
        .map((p) => p.outsourceLabId)
        .filter((x): x is string => !!x),
    ),
  ];

  const [client, analysts, assignedUsers, labs, usedLabs, quotation] =
    await Promise.all([
    seeClient
      ? prisma.client.findUnique({
          where: { id: sample.clientId },
          select: { company: true, clientNo: true },
        })
      : Promise.resolve(null),
    canAssign
      ? prisma.user.findMany({
          where: {
            designation: { in: [...ANALYST_DESIGNATIONS] },
            status: "ACTIVE",
            facilityId: sample.facilityId,
          },
          include: { profile: { select: { fullName: true } } },
        })
      : Promise.resolve([]),
    // Names for whoever is already assigned (may include analysts off the current
    // roster, e.g. since deactivated).
    assignedIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, email: true, profile: { select: { fullName: true } } },
        })
      : Promise.resolve([]),
    // Outsource labs available to assign to (only when the panel will show).
    canAssign
      ? prisma.outsourceLab.findMany({ select: { id: true, name: true } })
      : Promise.resolve([]),
    // Names for labs already assigned (so the source shows in any status).
    outsourceLabIds.length > 0
      ? prisma.outsourceLab.findMany({
          where: { id: { in: outsourceLabIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    // The quotation names the client, so it stays behind the same blinding gate.
    sample.quotationId && seeClient
      ? prisma.testQuotation.findUnique({
          where: { id: sample.quotationId },
          select: {
            id: true,
            quoteNo: true,
            subtotal: true,
            items: { select: { kind: true, refId: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  // Resolve assigned-analyst display names (roster first, then anyone extra).
  const nameById = new Map<string, string>();
  for (const a of analysts) nameById.set(a.id, a.profile?.fullName ?? a.email);
  for (const a of assignedUsers)
    if (!nameById.has(a.id)) nameById.set(a.id, a.profile?.fullName ?? a.email);
  const assignedNames = assignedIds
    .map((id) => nameById.get(id) ?? "—")
    .sort((a, b) => a.localeCompare(b));
  // Outsource-lab display names (roster + already-assigned).
  const labNameById = new Map<string, string>();
  for (const l of labs) labNameById.set(l.id, l.name);
  for (const l of usedLabs) if (!labNameById.has(l.id)) labNameById.set(l.id, l.name);

  // Which of the sample's tests the quotation actually covers. Packages are
  // expanded, since a quoted package is what put those parameters on the sample.
  const quotedParameterIds = new Set<string>();
  if (quotation) {
    const packageIds: string[] = [];
    for (const it of quotation.items) {
      if (!it.refId) continue;
      if (it.kind === "PACKAGE") packageIds.push(it.refId);
      else quotedParameterIds.add(it.refId);
    }
    if (packageIds.length > 0) {
      const links = await prisma.packageParameter.findMany({
        where: { packageId: { in: packageIds } },
        select: { parameterId: true },
      });
      for (const l of links) quotedParameterIds.add(l.parameterId);
    }
  }
  const extraCount = quotation
    ? sample.parameters.filter((p) => !quotedParameterIds.has(p.parameterId)).length
    : 0;

  // The viewer is an analyst on this sample if any parameter is assigned to them.
  const isAnalyst = sample.parameters.some((p) => p.assignedToId === user.id);
  // Show Limit/Conformity columns only when the sample is being conformed.
  const conformed = !!sample.standardId;

  // Assignment inputs for the per-parameter panel.
  const analystOpts = analysts.map((a) => ({
    id: a.id,
    name: a.profile?.fullName ?? a.email,
  }));
  const labOpts = labs.map((l) => ({ id: l.id, name: l.name }));
  const assignRows = sample.parameters.map((sp) => ({
    id: sp.id,
    name: sp.parameter.name,
    unit: sp.unit || sp.parameter.unit,
    assignedToId: sp.assignedToId,
    outsourceLabId: sp.outsourceLabId,
    hasResult: !!sp.resultValue,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/app/samples"
        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        ← Back to samples
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{sample.labId}</h1>
          <p className="text-sm text-muted-foreground">
            {sample.sampleType}
            {assignedNames.length === 1 && ` · analyst: ${assignedNames[0]}`}
            {assignedNames.length > 1 &&
              ` · analysts: ${assignedNames.join(", ")}`}
          </p>
          {quotation && (
            <p className="text-sm text-muted-foreground">
              Booked against{" "}
              <Link href={`/app/quotations/${quotation.id}`} className="underline">
                {quotation.quoteNo}
              </Link>
              {extraCount > 0 &&
                ` · ${extraCount} test${extraCount === 1 ? "" : "s"} beyond the quotation`}
            </p>
          )}
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
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Assign each parameter to an analyst or an outsourced lab. The sample
                  starts testing once every parameter has one.
                </p>
                <AssignPanel
                  sampleId={sample.id}
                  parameters={assignRows}
                  analysts={analystOpts}
                  labs={labOpts}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Awaiting assignment.</p>
            ))}

          {sample.status === "ASSIGNED" && (
            <div className="space-y-3">
              {isAnalyst && (
                <p className="text-sm text-muted-foreground">
                  Enter a result and upload the raw-data photo for the parameters
                  assigned to you.
                </p>
              )}
              {sample.parameters.map((sp) => {
                const mine = sp.assignedToId === user.id;
                const who = sp.assignedToId
                  ? nameById.get(sp.assignedToId) ?? "—"
                  : sp.outsourceLabId
                    ? `outsourced to ${labNameById.get(sp.outsourceLabId) ?? "external lab"}`
                    : "Unassigned";
                if (mine) {
                  return (
                    <ResultEntryForm
                      key={sp.id}
                      sampleParameterId={sp.id}
                      parameterName={sp.parameter.name}
                      unit={sp.unit || sp.parameter.unit}
                      hasResult={!!sp.resultValue}
                    />
                  );
                }
                return (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between border-t pt-3 text-sm"
                  >
                    <span>
                      {sp.parameter.name}{" "}
                      <span className="text-muted-foreground">· {who}</span>
                    </span>
                    <span>
                      {sp.resultValue ? (
                        sp.resultValue
                      ) : (
                        <span className="text-muted-foreground">pending</span>
                      )}
                    </span>
                  </div>
                );
              })}
              {!isAnalyst && !coordinator && (
                <p className="text-sm text-muted-foreground">
                  Assigned — results in progress.
                </p>
              )}
              {coordinator && (
                <details className="border-t pt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Reassign parameters (before their results are entered)
                  </summary>
                  <div className="pt-3">
                    <AssignPanel
                      sampleId={sample.id}
                      parameters={assignRows}
                      analysts={analystOpts}
                      labs={labOpts}
                    />
                  </div>
                </details>
              )}
            </div>
          )}

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
            <span className="text-muted-foreground">Client Sample ID</span>
            <span>{sample.clientSampleRef || "—"}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1">
            <span className="text-muted-foreground">Priority</span>
            <span>{priorityLabel(sample.priority)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Parameters &amp; results</CardTitle>
          {conformed && sample.standard && (
            <span className="text-sm text-muted-foreground">
              Conformed to{" "}
              <span className="font-medium text-foreground">{sample.standard.name}</span>
            </span>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Analyst / Source</TableHead>
                <TableHead>Result</TableHead>
                {conformed && <TableHead>Limit</TableHead>}
                {conformed && <TableHead>Conformity</TableHead>}
                <TableHead>Raw data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sample.parameters.map((sp) => {
                const limit = limitText(sp.limitMin, sp.limitMax, sp.unit || sp.parameter.unit);
                return (
                <TableRow key={sp.id}>
                  <TableCell>
                    {sp.parameter.name}
                    {(sp.unit || sp.parameter.unit) && (
                      <span className="text-muted-foreground"> ({sp.unit || sp.parameter.unit})</span>
                    )}
                    {quotation && !quotedParameterIds.has(sp.parameterId) && (
                      <span className="ml-2 rounded bg-muted px-1 text-xs text-muted-foreground">
                        not quoted
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.assignedToId
                      ? nameById.get(sp.assignedToId) ?? "—"
                      : sp.outsourceLabId
                        ? `${labNameById.get(sp.outsourceLabId) ?? "external lab"} (outsourced)`
                        : "—"}
                  </TableCell>
                  <TableCell>{sp.resultValue || "—"}</TableCell>
                  {conformed && (
                    <TableCell className="text-muted-foreground">{limit || "—"}</TableCell>
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
                  <TableCell className="text-muted-foreground">
                    {sp.outsourceLabId ? (
                      <span>
                        {sp.registerNo ? `Report ${sp.registerNo}` : null}
                        {sp.rawDataAttachmentId && (
                          <>
                            {sp.registerNo ? " · " : null}
                            <a
                              href={`/api/files/${sp.rawDataAttachmentId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#1ca9e6] hover:underline"
                            >
                              file
                            </a>
                          </>
                        )}
                        {!sp.registerNo && !sp.rawDataAttachmentId ? "—" : null}
                      </span>
                    ) : sp.registerNo ? (
                      `Reg ${sp.registerNo} · Pg ${sp.pageNo ?? "—"}`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
