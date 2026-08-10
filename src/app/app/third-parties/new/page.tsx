import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient } from "@/lib/auth/perms";
import { ThirdPartyForm } from "../third-party-form";

export default async function NewThirdPartyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterClient(user.designation)) redirect("/app/third-parties");

  const clients = await prisma.client.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    select: { id: true, company: true, sector: true },
    orderBy: { company: "asc" },
  });
  const clientOpts = clients.map((c) => ({
    id: c.id,
    label: c.company,
    sector: c.sector,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New third party</h1>
        <p className="text-sm text-muted-foreground">
          An entity a client asks the report to be issued in the name of.
        </p>
      </div>
      <ThirdPartyForm clients={clientOpts} />
    </div>
  );
}
