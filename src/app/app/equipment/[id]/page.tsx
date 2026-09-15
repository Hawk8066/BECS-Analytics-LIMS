import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageEquipment } from "@/lib/auth/perms";
import { calStatus } from "@/lib/equipment/calibration";
import {
  OPEN_REPAIR_STATUSES,
  REPAIR_KIND_LABEL,
  REPAIR_SITE_LABEL,
  REPAIR_STATUS_LABEL,
  repairStatusVariant,
} from "@/lib/equipment/repair";
import { AddCalibrationButton } from "./add-calibration-button";
import { AddQualificationButton } from "./add-qualification-button";
import { RequestRepairButton } from "./request-repair-button";
import { formatDate } from "@/lib/format";
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

const CAL_VARIANT = {
  VALID: "default",
  EXPIRED: "destructive",
  NONE: "outline",
} as const;

function d(date: Date): string {
  return formatDate(date);
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const eq = await prisma.equipment.findUnique({
    where: { id },
    include: {
      calibrations: { orderBy: { validUntil: "desc" } },
      qualifications: { orderBy: { performedOn: "asc" } },
      store: { select: { id: true, name: true, type: true } },
      repairs: {
        orderBy: { createdAt: "desc" },
        include: { pr: { select: { id: true, prNo: true, status: true } } },
      },
    },
  });
  if (!eq) notFound();
  if (
    !user.canReadCrossSection &&
    (eq.facilityId !== user.facilityId || eq.sectionId !== user.sectionId)
  ) {
    notFound();
  }

  const status = calStatus(eq.calibrations[0]?.validUntil);
  const canManage = canManageEquipment(user.designation);
  // Calibration and repair are both performed by a registered vendor.
  const vendors = canManage
    ? await prisma.vendor.findMany({
        orderBy: { company: "asc" },
        select: { id: true, company: true },
      })
    : [];
  // Only one repair can be live at a time, so the button becomes a link to it.
  const openRepair = eq.repairs.find((r) =>
    OPEN_REPAIR_STATUSES.includes(r.status),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{eq.assetTag}</h1>
          <p className="text-sm text-muted-foreground">
            {eq.name}
            {eq.make ? ` · ${eq.make}` : ""}
            {eq.model ? ` ${eq.model}` : ""}
            {eq.serialNo ? ` · S/N ${eq.serialNo}` : ""}
          </p>
          {/* The store it is carried on, then where it actually stands in the lab. */}
          <p className="text-sm text-muted-foreground">
            Store:{" "}
            {eq.store ? (
              <Link href={`/app/inventory/${eq.store.id}`} className="underline">
                {eq.store.name}
              </Link>
            ) : (
              <span className="text-amber-700">not recorded</span>
            )}
            {eq.location ? ` · in lab: ${eq.location}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{eq.status}</Badge>
          <Badge variant={CAL_VARIANT[status]}>Calibration: {status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repairs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repair No</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PR</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eq.repairs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/app/equipment/repairs/${r.id}`}
                      className="hover:underline"
                    >
                      {r.repairNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {REPAIR_KIND_LABEL[r.kind]}
                    <span className="block text-xs text-muted-foreground">
                      {d(r.reportedOn)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {REPAIR_SITE_LABEL[r.site]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.vendorName ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/app/procurement/${r.pr.id}`}
                      className="hover:underline"
                    >
                      {r.pr.prNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={repairStatusVariant(r.status)}>
                      {REPAIR_STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {eq.repairs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No repairs recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {canManage &&
            (openRepair ? (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={`/app/equipment/repairs/${openRepair.id}`}
                  className="font-medium text-primary underline"
                >
                  {openRepair.repairNo}
                </Link>{" "}
                is still open — finish it before raising another.
              </p>
            ) : (
              <RequestRepairButton equipmentId={eq.id} vendors={vendors} />
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calibration records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Calibrated</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Certificate No</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eq.calibrations.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{d(c.calibratedOn)}</TableCell>
                  <TableCell
                    className={
                      c.validUntil < new Date() ? "text-red-600" : undefined
                    }
                  >
                    {d(c.validUntil)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.calibratedBy || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.certificateNo || <span className="text-muted-foreground">—</span>}
                    {/* Certificates used to be uploaded; older records keep the file. */}
                    {c.certificateAttachmentId && (
                      <a
                        href={`/api/files/${c.certificateAttachmentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-[#1ca9e6] hover:underline"
                      >
                        file
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {eq.calibrations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No calibration records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {canManage && (
            <AddCalibrationButton equipmentId={eq.id} vendors={vendors} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qualification (IQ → OQ → PQ)</CardTitle>
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
              {eq.qualifications.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{q.type}</TableCell>
                  <TableCell>
                    <Badge variant={q.result === "PASS" ? "default" : "destructive"}>
                      {q.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d(q.performedOn)}
                  </TableCell>
                </TableRow>
              ))}
              {eq.qualifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Not yet qualified.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {canManage && <AddQualificationButton equipmentId={eq.id} />}
        </CardContent>
      </Card>
    </div>
  );
}
