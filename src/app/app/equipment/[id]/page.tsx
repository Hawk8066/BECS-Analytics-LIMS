import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageEquipment } from "@/lib/auth/perms";
import { calStatus } from "@/lib/equipment/calibration";
import { CalibrationForm } from "./calibration-form";
import { QualificationForm } from "./qualification-form";
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

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{eq.assetTag}</h1>
          <p className="text-sm text-muted-foreground">
            {eq.name}
            {eq.make ? ` · ${eq.make}` : ""}
            {eq.model ? ` ${eq.model}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{eq.status}</Badge>
          <Badge variant={CAL_VARIANT[status]}>Calibration: {status}</Badge>
        </div>
      </div>

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
                <TableHead>Certificate</TableHead>
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
                  <TableCell>
                    {c.certificateAttachmentId ? (
                      <a
                        href={`/api/files/${c.certificateAttachmentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1ca9e6] hover:underline"
                      >
                        cert
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
          {canManage && <CalibrationForm equipmentId={eq.id} />}
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
          {canManage && <QualificationForm equipmentId={eq.id} />}
        </CardContent>
      </Card>
    </div>
  );
}
