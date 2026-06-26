import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { canManageEquipment } from "@/lib/auth/perms";
import { calStatus } from "@/lib/equipment/calibration";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default async function EquipmentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const equipment = await prisma.equipment.findMany({
    where: readScope(user),
    include: { calibrations: { orderBy: { validUntil: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equipment</h1>
          <p className="text-sm text-muted-foreground">{equipment.length} in scope</p>
        </div>
        {canManageEquipment(user.designation) && (
          <Link href="/app/equipment/new" className={buttonVariants()}>
            Register equipment
          </Link>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Calibration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map((e) => {
              const status = calStatus(e.calibrations[0]?.validUntil);
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/app/equipment/${e.id}`} className="hover:underline">
                      {e.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.location || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={CAL_VARIANT[status]}>{status}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {equipment.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No equipment registered.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
