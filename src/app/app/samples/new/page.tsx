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

  const [clients, parameters] = await Promise.all([
    prisma.client.findMany({
      where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
      orderBy: { company: "asc" },
    }),
    prisma.parameter.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register sample</h1>
        <p className="text-sm text-muted-foreground">
          A coded Lab ID is assigned; the sample is blinded for testing.
        </p>
      </div>
      <SampleForm
        clients={clients.map((c) => ({
          id: c.id,
          label: `${c.company} (${c.clientNo})`,
        }))}
        parameters={parameters.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          accredited: p.accredited,
        }))}
      />
    </div>
  );
}
