import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canRegisterClient } from "@/lib/auth/perms";
import { ThirdPartyForm } from "../third-party-form";

export default async function NewThirdPartyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterClient(user.designation)) redirect("/app/third-parties");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New third party</h1>
        <p className="text-sm text-muted-foreground">
          An entity a client asks the report to be issued in the name of.
        </p>
      </div>
      <ThirdPartyForm />
    </div>
  );
}
