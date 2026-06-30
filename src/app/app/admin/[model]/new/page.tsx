import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { getModel } from "@/lib/admin/registry";
import { RecordForm } from "../../record-form";

export const dynamic = "force-dynamic";

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canAdminister(user.designation)) redirect("/app");

  const { model: modelName } = await params;
  const model = getModel(modelName);
  if (!model || !model.idField) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/app/admin" className="underline">
            Admin
          </Link>{" "}
          /{" "}
          <Link href={`/app/admin/${model.name}`} className="underline">
            {model.name}
          </Link>{" "}
          / new
        </p>
        <h1 className="text-2xl font-semibold">New {model.name}</h1>
      </div>

      <RecordForm
        modelName={model.name}
        fields={model.fields}
        initial={{}}
        showPasswordField={model.name === "User"}
      />
    </div>
  );
}
