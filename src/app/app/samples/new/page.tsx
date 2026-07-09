import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterSample } from "@/lib/auth/perms";
import { SampleForm } from "../sample-form";

export default async function NewSamplePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterSample(user.designation)) redirect("/app/samples");

  const [clients, parameters, facilities, packages] = await Promise.all([
    prisma.client.findMany({
      where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
      orderBy: { company: "asc" },
    }),
    prisma.parameter.findMany({
      where: { approvedAt: { not: null } },
      include: { sectorPrices: true },
      orderBy: { name: "asc" },
    }),
    prisma.facility.findMany({ orderBy: { code: "asc" } }),
    prisma.package.findMany({
      orderBy: { name: "asc" },
      include: { parameters: { select: { parameterId: true } }, prices: true },
    }),
  ]);

  const LAB_NAMES: Record<string, string> = {
    LAHORE: "Lahore",
    RYK: "Rahimyar Khan",
  };
  const labs = facilities.map((f) => ({ id: f.id, name: LAB_NAMES[f.code] ?? f.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register sample</h1>
        <p className="text-sm text-muted-foreground">
          A coded Lab ID is assigned; the sample is blinded for testing.
        </p>
      </div>
      <SampleForm
        labs={labs}
        defaultLabId={user.facilityId}
        clients={clients.map((c) => ({
          id: c.id,
          label: c.company,
        }))}
        parameters={parameters.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          accredited: p.accredited,
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
