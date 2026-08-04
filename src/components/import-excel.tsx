import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { getModel } from "@/lib/admin/registry";
import { autoFillPlan, columnHints } from "@/lib/xlsx/plan";
import { ImportExcelForm } from "./import-excel-form";

/**
 * Drop-in "Import from Excel" control for any list page:
 *
 *   <ImportExcel model="Client" path="/app/clients" label="clients" />
 *
 * Renders nothing for non-admins, so pages don't need their own gate. Column
 * hints come from the Prisma DMMF, so they stay correct as the schema changes.
 */
export async function ImportExcel({
  model: modelName,
  path,
  label,
}: {
  /** Prisma model name, e.g. "Client". */
  model: string;
  /** Path to revalidate after a successful import. */
  path: string;
  label: string;
}) {
  const user = await getSessionUser();
  if (!user || user.status !== "ACTIVE") return null;
  if (!canAdminister(user.designation)) return null;

  const model = getModel(modelName);
  if (!model || !model.idField) return null;

  const { required, optional, money, autoFilled } = columnHints(
    model,
    autoFillPlan(model, user),
  );

  return (
    <ImportExcelForm
      model={model.name}
      path={path}
      label={label}
      required={required}
      optional={optional}
      money={money}
      autoFilled={autoFilled}
    />
  );
}
