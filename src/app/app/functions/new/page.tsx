import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canManageFunctions } from "@/lib/auth/perms";
import { FunctionForm } from "../function-form";

export default async function NewFunctionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManageFunctions(user.designation)) redirect("/app/functions");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New function</h1>
        <p className="text-sm text-muted-foreground">
          OM-created functions await COO approval before use.
        </p>
      </div>
      <FunctionForm />
    </div>
  );
}
