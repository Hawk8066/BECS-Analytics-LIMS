import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canRegisterClient } from "@/lib/auth/perms";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterClient(user.designation)) redirect("/app/clients");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register client</h1>
        <p className="text-sm text-muted-foreground">
          A client number is assigned automatically.
        </p>
      </div>
      <ClientForm />
    </div>
  );
}
