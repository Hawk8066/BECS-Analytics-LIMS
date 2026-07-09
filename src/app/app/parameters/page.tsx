import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageParameters, canApproveParameter } from "@/lib/auth/perms";
import { approveParameter } from "@/lib/actions/parameters";
import { SECTORS } from "@/lib/sectors";
import { AddParameter } from "./add-parameter";
import { SectorPrices } from "./sector-prices";
import { Packages } from "./packages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const [parameters, sectorPrices, packages] = await Promise.all([
    prisma.parameter.findMany({ orderBy: { name: "asc" } }),
    prisma.parameterSectorPrice.findMany(),
    prisma.package.findMany({
      orderBy: { name: "asc" },
      include: {
        parameters: { include: { parameter: { select: { name: true } } } },
        prices: true,
      },
    }),
  ]);
  const canManage = canManageParameters(user.designation);
  const canApprove = canApproveParameter(user.designation);

  // prices[parameterId][sector] = paisa
  const priceMap: Record<string, Record<string, number>> = {};
  for (const sp of sectorPrices) {
    (priceMap[sp.parameterId] ??= {})[sp.sector] = sp.price;
  }
  const packageData = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    parameters: pkg.parameters.map((pp) => pp.parameter.name),
    prices: Object.fromEntries(pkg.prices.map((p) => [p.sector, p.price])),
  }));

  const detailsPanel = (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parameter</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Matrix</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>LOD</TableHead>
              <TableHead>LOQ</TableHead>
              <TableHead>Accredited</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.unit || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.matrix || "—"}</TableCell>
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
            {parameters.length === 0 && (
              <TableRow>
                <TableCell colSpan={canApprove ? 9 : 8} className="text-center text-muted-foreground">
                  No parameters yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {canManage && <AddParameter />}
    </div>
  );

  const pricesPanel = (
    <SectorPrices
      sectors={SECTORS}
      parameters={parameters.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
      prices={priceMap}
      canManage={canManage}
    />
  );

  const packagesPanel = (
    <Packages
      sectors={SECTORS}
      parameters={parameters.map((p) => ({ id: p.id, name: p.name }))}
      packages={packageData}
      canManage={canManage}
    />
  );

  const tabs: TabItem[] = [
    { key: "parameters", label: "Parameters", content: detailsPanel },
    { key: "prices", label: "Prices", content: pricesPanel },
    { key: "packages", label: "Packages", content: packagesPanel },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parameters &amp; Prices</h1>
        <p className="text-sm text-muted-foreground">
          Master list; proposals are approved by the COO before they can be used.
        </p>
      </div>
      <Tabs tabs={tabs} defaultTab="parameters" />
    </div>
  );
}
