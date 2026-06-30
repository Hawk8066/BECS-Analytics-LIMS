import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { getModel, delegateFor } from "@/lib/admin/registry";
import { displayValue, toDatetimeLocal } from "@/lib/admin/values";
import { RecordForm } from "../../record-form";
import { DeleteRecord } from "../../delete-record";

export const dynamic = "force-dynamic";

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ model: string; id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canAdminister(user.designation)) redirect("/app");

  const { model: modelName, id } = await params;
  const model = getModel(modelName);
  if (!model || !model.idField) notFound();

  const row: Record<string, unknown> | null = await delegateFor(model).findUnique({
    where: { [model.idField]: id },
  });
  if (!row) notFound();

  // Pre-fill values per field type (datetime needs the datetime-local format).
  const initial: Record<string, string> = {};
  for (const f of model.fields) {
    initial[f.name] =
      f.type === "datetime" ? toDatetimeLocal(row[f.name]) : displayValue(row[f.name]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/admin" className="underline">
              Admin
            </Link>{" "}
            /{" "}
            <Link href={`/app/admin/${model.name}`} className="underline">
              {model.name}
            </Link>{" "}
            / edit
          </p>
          <h1 className="text-2xl font-semibold">Edit {model.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{id}</p>
        </div>
        <DeleteRecord modelName={model.name} id={id} />
      </div>

      <RecordForm
        modelName={model.name}
        id={id}
        fields={model.fields}
        initial={initial}
        showPasswordField={model.name === "User"}
      />
    </div>
  );
}
