import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageQuotations } from "@/lib/auth/perms";
import { QuotationForm } from "../quotation-form";

export default async function NewQuotationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManageQuotations(user.designation)) redirect("/app/quotations");

  const [clients, parameters, packages] = await Promise.all([
    prisma.client.findMany({ orderBy: { company: "asc" } }),
    prisma.parameter.findMany({
      where: { approvedAt: { not: null } },
      include: { sectorPrices: true },
      orderBy: { name: "asc" },
    }),
    prisma.package.findMany({
      orderBy: { name: "asc" },
      include: { parameters: { select: { parameterId: true } }, prices: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New quotation</h1>
        <p className="text-sm text-muted-foreground">
          Pick a client and sector, then select parameters/packages; prices come
          from the sector price list.
        </p>
      </div>
      <QuotationForm
        clients={clients.map((c) => ({ id: c.id, label: c.company }))}
        matrices={[
          ...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m)),
        ].sort()}
        parameters={parameters.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          matrix: p.matrix,
          prices: Object.fromEntries(p.sectorPrices.map((sp) => [sp.sector, sp.price])),
        }))}
        packages={packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          parameterIds: pkg.parameters.map((x) => x.parameterId),
          prices: Object.fromEntries(pkg.prices.map((x) => [x.sector, x.price])),
        }))}
      />
    </div>
  );
}
