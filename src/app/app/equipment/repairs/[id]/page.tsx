import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  canInspectGoods,
  canIssueGatePass,
  canManageEquipment,
  canReceiveRepair,
} from "@/lib/auth/perms";
import { canAccessPR } from "@/lib/procurement/access";
import {
  REPAIR_KIND_LABEL,
  REPAIR_SITE_LABEL,
  REPAIR_STATUS_LABEL,
  missingQualifications,
  repairStatusVariant,
} from "@/lib/equipment/repair";
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
import { AddQualificationButton } from "../../[id]/add-qualification-button";
import { IssueGatePassButton } from "./issue-gate-pass-button";
import { ReceiveRepairButton } from "./receive-repair-button";
import { InspectRepairButton } from "./inspect-repair-button";
import { ReturnToServiceForm } from "./return-to-service-form";
import { CancelRepairButton } from "./cancel-repair-button";

const PR_HINT: Record<string, string> = {
  SUBMITTED: "Awaiting verification.",
  VERIFIED: "Awaiting COO approval.",
  APPROVED: "Approved — record quotations and award the comparative.",
  ORDERED: "A purchase order has been issued.",
  REJECTED: "This request was rejected.",
};

export default async function RepairCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const repair = await prisma.equipmentRepair.findUnique({
    where: { id },
    include: {
      equipment: {
        select: {
          id: true,
          assetTag: true,
          name: true,
          make: true,
          model: true,
          serialNo: true,
          status: true,
          location: true,
        },
      },
      pr: {
        select: {
          id: true,
          prNo: true,
          status: true,
          pos: { select: { id: true, poNo: true, vendor: { select: { company: true } } } },
        },
      },
      vendor: { select: { id: true, company: true } },
      gatePasses: { orderBy: { outDate: "desc" } },
      qualifications: { orderBy: { performedOn: "asc" } },
    },
  });
  if (!repair) notFound();
  // Repairs are read by the same rule as the PR they raised.
  if (!canAccessPR(user, repair)) notFound();

  const canManage = canManageEquipment(user.designation);
  const openPass = repair.gatePasses.find((g) => g.status === "OUT");
  const prReady = repair.pr.status === "APPROVED" || repair.pr.status === "ORDERED";
  const missing = missingQualifications(
    repair.qualifications.filter((q) => q.result === "PASS"),
  );
  const vendors =
    canManage || canIssueGatePass(user.designation)
      ? await prisma.vendor.findMany({
          orderBy: { company: "asc" },
          select: { id: true, company: true },
        })
      : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{repair.repairNo}</h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/app/equipment/${repair.equipment.id}`}
              className="underline"
            >
              {repair.equipment.assetTag}
            </Link>{" "}
            · {repair.equipment.name}
            {repair.equipment.make ? ` · ${repair.equipment.make}` : ""}
            {repair.equipment.model ? ` ${repair.equipment.model}` : ""}
            {repair.equipment.serialNo ? ` · S/N ${repair.equipment.serialNo}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Badge variant={repairStatusVariant(repair.status)}>
            {REPAIR_STATUS_LABEL[repair.status]}
          </Badge>
          <Badge variant="outline">{repair.equipment.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">Reason</dt>
              <dd>{REPAIR_KIND_LABEL[repair.kind]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Where</dt>
              <dd>
                {REPAIR_SITE_LABEL[repair.site]}
                {repair.site === "OFF_SITE" ? " — gate pass required" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vendor</dt>
              <dd>{repair.vendorName ?? "to be awarded"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Reported</dt>
              <dd>{formatDate(repair.reportedOn)}</dd>
            </div>
          </dl>
          <div>
            <p className="text-xs text-muted-foreground">
              {repair.kind === "BREAKDOWN" ? "Fault reported" : "Maintenance required"}
            </p>
            <p className="whitespace-pre-wrap">{repair.reason}</p>
          </div>
          {repair.note && (
            <p className="text-muted-foreground">{repair.note}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground">Purchase request</span>
            <Link
              href={`/app/procurement/${repair.pr.id}`}
              className="font-mono text-xs underline"
            >
              {repair.pr.prNo}
            </Link>
            <Badge variant="outline">{repair.pr.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {PR_HINT[repair.pr.status] ?? ""}
            </span>
          </div>
          {repair.pr.pos.map((po) => (
            <div key={po.id} className="text-xs text-muted-foreground">
              PO{" "}
              <Link
                href={`/app/procurement/po/${po.id}`}
                className="font-mono underline"
              >
                {po.poNo}
              </Link>
              {po.vendor ? ` · ${po.vendor.company}` : ""}
            </div>
          ))}
        </CardContent>
      </Card>

      {repair.site === "OFF_SITE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gate passes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gate Pass</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Expected back</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repair.gatePasses.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/app/equipment/gate-passes/${g.id}`}
                        className="hover:underline"
                      >
                        {g.gatePassNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.vendorName ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(g.outDate)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.expectedReturnDate ? formatDate(g.expectedReturnDate) : "—"}
                    </TableCell>
                    <TableCell>
                      {g.actualReturnDate ? formatDate(g.actualReturnDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.status === "OUT" ? "destructive" : "default"}>
                        {g.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {repair.gatePasses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Not yet released for repair.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {canIssueGatePass(user.designation) &&
              repair.status === "REQUESTED" &&
              !openPass &&
              (prReady ? (
                <IssueGatePassButton
                  repairId={repair.id}
                  vendors={vendors}
                  defaultVendorId={repair.vendorId ?? ""}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {repair.pr.prNo} must be approved by the COO before the asset
                  can leave the premises.
                </p>
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receiving &amp; inspection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">Received back</dt>
              <dd>{repair.receivedOn ? formatDate(repair.receivedOn) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Inspection</dt>
              <dd>
                {repair.inspectionResult ? (
                  <Badge
                    variant={
                      repair.inspectionResult === "ACCEPTED"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {repair.inspectionResult}
                  </Badge>
                ) : (
                  "—"
                )}
                {repair.inspectedAt ? ` · ${formatDate(repair.inspectedAt)}` : ""}
              </dd>
            </div>
          </dl>
          {repair.inspectionNote && (
            <p className="text-muted-foreground">{repair.inspectionNote}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {canReceiveRepair(user.designation) &&
              (repair.status === "GATE_PASSED" ||
                (repair.site === "ON_SITE" && repair.status === "REQUESTED")) && (
                <ReceiveRepairButton
                  repairId={repair.id}
                  offSite={repair.site === "OFF_SITE"}
                />
              )}
            {canInspectGoods(user.designation) && repair.status === "RECEIVED" && (
              <InspectRepairButton repairId={repair.id} />
            )}
          </div>
          {repair.status === "REQUESTED" && repair.inspectionResult === "REJECTED" && (
            <p className="text-sm text-amber-700">
              The last inspection was rejected — the asset goes back to the vendor
              on a new gate pass.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Requalification (IQ → OQ → PQ)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repair.qualifications.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{q.type}</TableCell>
                  <TableCell>
                    <Badge
                      variant={q.result === "PASS" ? "default" : "destructive"}
                    >
                      {q.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(q.performedOn)}
                  </TableCell>
                </TableRow>
              ))}
              {repair.qualifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Not yet requalified.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {canManage && repair.status === "INSPECTED" && (
            <AddQualificationButton
              equipmentId={repair.equipmentId}
              repairId={repair.id}
            />
          )}
          {canManage && (
            <ReturnToServiceForm
              repairId={repair.id}
              ready={
                repair.status === "INSPECTED" &&
                repair.inspectionResult === "ACCEPTED" &&
                missing.length === 0
              }
              reason={
                repair.status === "IN_SERVICE"
                  ? "This asset is back in service."
                  : repair.status !== "INSPECTED"
                    ? "The repair must be received and inspected first."
                    : repair.inspectionResult !== "ACCEPTED"
                      ? "The inspection must be accepted first."
                      : `Record ${missing.join(", ")} (PASS) before returning it to service.`
              }
            />
          )}
        </CardContent>
      </Card>

      {canManage && repair.status !== "IN_SERVICE" && repair.status !== "CANCELLED" && (
        <CancelRepairButton repairId={repair.id} />
      )}
    </div>
  );
}
