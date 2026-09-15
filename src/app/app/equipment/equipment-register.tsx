import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { canManageEquipment } from "@/lib/auth/perms";
import { calStatus } from "@/lib/equipment/calibration";
import { formatDate } from "@/lib/format";
import { resolveFacility, type FacilitySlug } from "@/lib/facilities";
import { ImportExcel } from "@/components/import-excel";
import { Badge } from "@/components/ui/badge";
import { RegisterEquipmentButton } from "./register-equipment-button";
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

/** One lab's equipment register. Mounted at /app/equipment/<slug>. */
export async function EquipmentRegister({ slug }: { slug: FacilitySlug }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const facility = await resolveFacility(slug, user);
  if (!facility) notFound();

  const canManage = canManageEquipment(user.designation);
  const [equipment, subStores, vendors] = await Promise.all([
    prisma.equipment.findMany({
      // The lab's own filter narrows the actor's scope; it never widens it.
      where: { ...readScope(user), facilityId: facility.id },
      include: {
        calibrations: { orderBy: { validUntil: "desc" }, take: 1 },
        store: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Equipment is registered out of this lab's sub-stores only (BR-10) — the
    // popup needs that list up front, since it opens without a page load.
    canManage
      ? prisma.store.findMany({
          where: { facilityId: facility.id, type: "SUB" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    // Calibration is done by a registered vendor or in-house, so the popup
    // offers the vendor list rather than a free-text name.
    canManage
      ? prisma.vendor.findMany({
          orderBy: { company: "asc" },
          select: { id: true, company: true },
        })
      : [],
  ]);
  const unlinked = equipment.filter((e) => !e.storeId).length;

  const items = subStores.length
    ? await prisma.inventoryItem.findMany({
        where: {
          category: "EQUIPMENT",
          storeId: { in: subStores.map((s) => s.id) },
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          make: true,
          model: true,
          store: { select: { name: true } },
          equipment: { select: { id: true }, take: 1 },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Equipment — {facility.route.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {equipment.length} registered in this lab
          </p>
        </div>
        {canManage && (
          <RegisterEquipmentButton
            labName={facility.route.name}
            vendors={vendors}
            hasSubStore={subStores.length > 0}
            multipleStores={subStores.length > 1}
            storeHref={subStores[0] ? `/app/inventory/${subStores[0].id}` : "/app/inventory"}
            items={items.map((i) => ({
              id: i.id,
              name: i.name,
              code: i.code,
              make: i.make,
              model: i.model,
              storeName: i.store.name,
              registered: i.equipment.length > 0,
            }))}
          />
        )}
      </div>

      <ImportExcel
        model="Equipment"
        path={`/app/equipment/${slug}`}
        label="equipment"
      />

      {unlinked > 0 && (
        <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {unlinked} item{unlinked === 1 ? " was" : "s were"} registered before
          equipment was tied to sub-stores, so{" "}
          {unlinked === 1 ? "it has" : "they have"} no sub-store or lab location.
          Re-register {unlinked === 1 ? "it" : "them"} from the sub-store{" "}
          {unlinked === 1 ? "it was" : "they were"} issued to in order to
          complete the record.
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sub-store</TableHead>
              <TableHead>Lab location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Calibrated</TableHead>
              <TableHead>Valid until</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map((e) => {
              const cal = e.calibrations[0];
              const status = calStatus(cal?.validUntil);
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/app/equipment/${e.id}`} className="hover:underline">
                      {e.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.store ? e.store.name : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.location || "—"}
                  </TableCell>
                  <TableCell>
                    {/* An asset out of service should be obvious in the list. */}
                    <Badge
                      variant="outline"
                      className={
                        e.status === "UNDER_REPAIR"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : undefined
                      }
                    >
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cal ? formatDate(cal.calibratedOn) : "—"}
                  </TableCell>
                  <TableCell>
                    {cal ? (
                      <span
                        className={status === "EXPIRED" ? "text-red-600" : undefined}
                      >
                        {formatDate(cal.validUntil)}
                      </span>
                    ) : (
                      <Badge variant={CAL_VARIANT[status]}>DUE</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {equipment.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No equipment registered in {facility.route.name}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
