import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageParameters, canApproveParameter } from "@/lib/auth/perms";
import { approveAllParameters, approveParameter } from "@/lib/actions/parameters";
import { priceEntry, type PriceEntry } from "@/lib/pricing";
import { AddParameter } from "./add-parameter";
import { SectorPrices } from "./sector-prices";
import { Packages } from "./packages";
import { Standards } from "./standards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ParametersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const [parameters, priceDateRows, packages, standards] = await Promise.all([
    prisma.parameter.findMany({ orderBy: { name: "asc" } }),
    // Latest change per parameter, to show "Last set" beside the price boxes.
    prisma.parameterPriceHistory.groupBy({
      by: ["parameterId"],
      _max: { changedAt: true },
    }),
    prisma.package.findMany({
      orderBy: { name: "asc" },
      include: {
        parameters: { include: { parameter: { select: { name: true } } } },
        priceHistory: {
          orderBy: { changedAt: "desc" },
          take: 1,
          select: { changedAt: true },
        },
      },
    }),
    prisma.standard.findMany({
      orderBy: { name: "asc" },
      include: {
        limits: {
          include: {
            parameter: { select: { name: true, matrix: true, unit: true } },
          },
        },
      },
    }),
  ]);
  const canManage = canManageParameters(user.designation);
  const canApprove = canApproveParameter(user.designation);

  // prices[parameterId] = { normal, urgent } in paisa — one price per parameter.
  const priceMap: Record<string, PriceEntry> = {};
  for (const p of parameters) priceMap[p.id] = priceEntry(p);
  // When each price was last set — shown beside the box so a figure can be
  // traced to a date without opening the full trail.
  const priceDates: Record<string, string> = {};
  for (const r of priceDateRows) {
    if (r._max.changedAt) priceDates[r.parameterId] = r._max.changedAt.toISOString();
  }
  const packageData = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    matrix: pkg.matrix,
    parameters: pkg.parameters.map((pp) => pp.parameter.name),
    price: priceEntry(pkg),
    lastSet: pkg.priceHistory[0]?.changedAt.toISOString(),
  }));

  // Group parameters by matrix for the details table.
  const cols = canApprove ? 9 : 8;
  const tat = (days: number | null) => (days === null ? "—" : `${days}d`);
  const paramGroups = new Map<string, typeof parameters>();
  for (const p of [...parameters].sort(
    (a, b) =>
      (a.matrix ?? "~").localeCompare(b.matrix ?? "~") ||
      a.name.localeCompare(b.name),
  )) {
    const key = p.matrix || "— (no matrix)";
    if (!paramGroups.has(key)) paramGroups.set(key, []);
    paramGroups.get(key)!.push(p);
  }

  // Pending parameters are invisible to quotations and sample booking, which is
  // the usual reason a freshly uploaded list "doesn't show up" on those forms.
  const pending = parameters.filter((p) => !p.approvedAt).length;

  // Offer the values already in use, so a hand-added parameter files under an
  // existing matrix/unit instead of creating a near-duplicate of one.
  const usedMatrices = [
    ...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m)),
  ].sort();
  const usedUnits = [
    ...new Set(parameters.map((p) => p.unit).filter((u): u is string => !!u)),
  ].sort();

  const detailsPanel = (
    <div className="space-y-6">
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {parameters.length} parameter{parameters.length === 1 ? "" : "s"} in the
            master list.
          </p>
          <AddParameter matrices={usedMatrices} units={usedUnits} />
        </div>
      )}

      {pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
          <p className="text-sm">
            <span className="font-medium">{pending}</span> parameter
            {pending === 1 ? " is" : "s are"} pending COO approval — until approved
            {pending === 1 ? " it" : " they"} cannot be quoted or booked on a sample.
          </p>
          {canApprove && (
            <form action={approveAllParameters}>
              <Button size="sm" type="submit">
                Approve all {pending}
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parameter</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>
                TAT
                <span className="block font-normal text-muted-foreground">
                  normal / urgent
                </span>
              </TableHead>
              <TableHead>Method</TableHead>
              <TableHead>LOD</TableHead>
              <TableHead>LOQ</TableHead>
              <TableHead>Accredited</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...paramGroups.entries()].map(([matrix, list]) => (
              <Fragment key={matrix}>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell colSpan={cols} className="font-semibold">
                    {matrix}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({list.length})
                    </span>
                  </TableCell>
                </TableRow>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.unit || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {tat(p.tatDays)} / {tat(p.tatUrgentDays)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.method || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.lod || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.loq || "—"}</TableCell>
                    <TableCell>
                      {p.accredited ? (
                        <Badge>Accredited</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.approvedAt ? (
                        <Badge>Approved</Badge>
                      ) : (
                        <Badge variant="outline">Pending COO</Badge>
                      )}
                    </TableCell>
                    {canApprove && (
                      <TableCell className="text-right">
                        {!p.approvedAt && (
                          <form action={approveParameter}>
                            <input type="hidden" name="parameterId" value={p.id} />
                            <Button size="sm" type="submit">
                              Approve
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {parameters.length === 0 && (
              <TableRow>
                <TableCell colSpan={cols} className="text-center text-muted-foreground">
                  No parameters yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const pricesPanel = (
    <SectorPrices
      parameters={parameters.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        matrix: p.matrix,
        tatDays: p.tatDays,
        tatUrgentDays: p.tatUrgentDays,
      }))}
      prices={priceMap}
      dates={priceDates}
      canManage={canManage}
    />
  );

  const packagesPanel = (
    <Packages
      parameters={parameters.map((p) => ({ id: p.id, name: p.name, matrix: p.matrix }))}
      packages={packageData}
      canManage={canManage}
    />
  );

  const standardsPanel = (
    <Standards
      parameters={parameters.map((p) => ({
        id: p.id,
        name: p.name,
        matrix: p.matrix,
        unit: p.unit,
      }))}
      standards={standards.map((s) => ({
        id: s.id,
        name: s.name,
        matrix: s.matrix,
        description: s.description,
        limits: s.limits
          .map((l) => ({
            id: l.id,
            parameterId: l.parameterId,
            parameterName: l.parameter.name,
            matrix: l.parameter.matrix,
            unit: l.unit ?? l.parameter.unit,
            min: l.min,
            max: l.max,
          }))
          .sort((a, b) => a.parameterName.localeCompare(b.parameterName)),
      }))}
      canManage={canManage}
    />
  );

  const tabs: TabItem[] = [
    { key: "parameters", label: "Parameters", content: detailsPanel },
    { key: "prices", label: "Prices", content: pricesPanel },
    { key: "packages", label: "Packages", content: packagesPanel },
    { key: "standards", label: "Standards", content: standardsPanel },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parameters &amp; Prices</h1>
        <p className="text-sm text-muted-foreground">
          Master list; proposals are approved by the COO before they can be used.
        </p>
      </div>

      <ImportExcel model="Parameter" path="/app/parameters" label="parameters" />

      <Tabs tabs={tabs} defaultTab="parameters" />
    </div>
  );
}
