import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canRegisterOutsourceLab } from "@/lib/auth/perms";
import { OutsourceLabForm } from "../outsource-lab-form";

export default async function NewOutsourceLabPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterOutsourceLab(user.designation)) redirect("/app/outsource-labs");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register outsource lab</h1>
        <p className="text-sm text-muted-foreground">
          A lab number is assigned automatically; a portal login is created for the
          representative.
        </p>
      </div>
      <OutsourceLabForm />
    </div>
  );
}
