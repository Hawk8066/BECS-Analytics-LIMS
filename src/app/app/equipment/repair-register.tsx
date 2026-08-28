import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { formatDate } from "@/lib/format";
import { resolveFacility, type FacilitySlug } from "@/lib/facilities";
import {
  OPEN_REPAIR_STATUSES,
  REPAIR_KIND_LABEL,
  REPAIR_SITE_LABEL,
  REPAIR_STATUS_LABEL,
  repairStatusVariant,
} from "@/lib/equipment/repair";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
] as const;

/** One lab's repair register. Mounted at /app/equipment/<slug>/repairs. */
export async function RepairRegister({
  slug,
  searchParams,
}: {
  slug: FacilitySlug;
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const facility = await resolveFacility(slug, user);
  if (!facility) notFound();

  const { view } = await searchParams;
  const showAll = view === "all";

  const repairs = await prisma.equipmentRepair.findMany({
    // The lab's own filter narrows the actor's scope; it never widens it.
    where: {
      ...readScope(user),
      facilityId: facility.id,
      ...(showAll ? {} : { status: { in: OPEN_REPAIR_STATUSES } }),
    },
    include: {
      equipment: { select: { id: true, assetTag: true, name: true } },
      pr: { select: { id: true, prNo: true, status: true } },
      gatePasses: {
        where: { status: "OUT" },
        select: { expectedReturnDate: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const today = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Equipment repairs — {facility.route.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {repairs.length} {showAll ? "recorded" : "open"} in this lab
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/app/equipment/${slug}/repairs${f.key === "all" ? "?view=all" : ""}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              (f.key === "all") === showAll
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repair No</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>PR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reported</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repairs.map((r) => {
              // An asset that is out and past its promised return date is the
              // one thing this list exists to surface.
              const due = r.gatePasses[0]?.expectedReturnDate;
              const overdue = due != null && due < today;
              return (
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
                    <Link
                      href={`/app/equipment/${r.equipment.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {r.equipment.assetTag}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.equipment.name}
                    </span>
                  </TableCell>
                  <TableCell>{REPAIR_KIND_LABEL[r.kind]}</TableCell>
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
                    <span className="block text-xs text-muted-foreground">
                      {r.pr.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={repairStatusVariant(r.status)}>
                      {REPAIR_STATUS_LABEL[r.status]}
                    </Badge>
                    {overdue && (
                      <span className="block text-xs text-red-600">
                        overdue since {formatDate(due)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.reportedOn)}
                  </TableCell>
                </TableRow>
              );
            })}
            {repairs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {showAll
                    ? `No repairs recorded in ${facility.route.name}.`
                    : `No open repairs in ${facility.route.name}.`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
