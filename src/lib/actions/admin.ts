"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "argon2";
import { requireUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import {
  getModel,
  delegateFor,
  isSensitiveField,
  type AdminModel,
} from "@/lib/admin/registry";
import { coerce, CoerceError, toPlain } from "@/lib/admin/values";

export type FormState = { error?: string; ok?: boolean };

async function requireAdmin() {
  const actor = await requireUser();
  if (!canAdminister(actor.designation)) {
    throw new Error("Forbidden: application admin access required.");
  }
  return actor;
}

/**
 * Strip sensitive columns before a row goes into the audit log.
 *
 * `writeAudit` copies whole rows into AuditLog.before/after, and /app/logs
 * renders them — so without this every admin edit of a User wrote that user's
 * Argon2 hash into an append-only table and displayed it. The audit log is
 * deliberately immutable (BR-5), which means a leak there cannot be cleaned up
 * afterwards; it has to not happen.
 *
 * Redacted rather than dropped, so the log still records that the field changed.
 */
function redact(
  model: AdminModel,
  row: Record<string, unknown> | null | undefined,
): object {
  const plain = toPlain(row) as Record<string, unknown>;
  if (!plain || typeof plain !== "object") return {};
  for (const key of Object.keys(plain))
    if (isSensitiveField(model.name, key)) plain[key] = "[redacted]";
  return plain;
}

// Pull scope stamps off a row (if the model carries them) for the audit entry.
function scopeOf(row: Record<string, unknown> | null | undefined) {
  return {
    facilityId: (row?.facilityId as string | undefined) ?? null,
    sectionId: (row?.sectionId as string | undefined) ?? null,
  };
}

// Build the Prisma write payload from submitted form fields, coercing each by type.
async function buildData(
  model: AdminModel,
  formData: FormData,
  mode: "create" | "update",
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  for (const field of model.fields) {
    if (!field.editable) continue;
    const raw = formData.get(field.name);
    const rawStr = raw === null ? null : String(raw);

    // On create, let schema defaults apply when the value is left blank.
    if (mode === "create" && (rawStr === null || rawStr === "") && field.hasDefault) {
      continue;
    }
    const value = coerce(field, rawStr);
    if (value === undefined) continue;
    data[field.name] = value;
  }

  // Convenience: hash a plaintext password typed into the special field.
  const newPassword = formData.get("__newPassword");
  if (typeof newPassword === "string" && newPassword.length > 0) {
    data.passwordHash = await hash(newPassword);
  }

  return data;
}

// Create or update a record (single-PK models). Hidden fields: __model, __id.
export async function adminSaveRecord(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin();

  const modelName = String(formData.get("__model") ?? "");
  const id = String(formData.get("__id") ?? "");
  const model = getModel(modelName);
  if (!model) return { error: `Unknown model: ${modelName}` };
  if (!model.idField)
    return { error: `${modelName} has no single-column primary key and is read-only.` };

  const delegate = delegateFor(model);

  try {
    const data = await buildData(model, formData, id ? "update" : "create");

    if (id) {
      const before = await delegate.findUnique({ where: { [model.idField]: id } });
      if (!before) return { error: "Record not found." };
      const after = await delegate.update({
        where: { [model.idField]: id },
        data,
      });
      await writeAudit({
        actorId: actor.id,
        action: "UPDATE",
        entityType: model.name,
        entityId: id,
        before: redact(model, before),
        after: redact(model, after),
        ...scopeOf(after),
      });
    } else {
      const created = await delegate.create({ data });
      await writeAudit({
        actorId: actor.id,
        action: "CREATE",
        entityType: model.name,
        entityId: String(created[model.idField]),
        after: toPlain(created) as object,
        ...scopeOf(created),
      });
    }
  } catch (err) {
    if (err instanceof CoerceError) return { error: err.message };
    const msg = err instanceof Error ? err.message : "Save failed.";
    return { error: msg };
  }

  revalidatePath(`/app/admin/${model.name}`);
  redirect(`/app/admin/${model.name}`);
}

// Delete a record (single-PK models). Hidden fields: __model, __id.
export async function adminDeleteRecord(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const modelName = String(formData.get("__model") ?? "");
  const id = String(formData.get("__id") ?? "");
  const model = getModel(modelName);
  if (!model || !model.idField) throw new Error("Model is not deletable.");

  const delegate = delegateFor(model);
  const before = await delegate.findUnique({ where: { [model.idField]: id } });
  if (!before) throw new Error("Record not found.");

  await delegate.delete({ where: { [model.idField]: id } });

  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: model.name,
    entityId: id,
    before: redact(model, before),
    ...scopeOf(before),
  });

  revalidatePath(`/app/admin/${model.name}`);
  redirect(`/app/admin/${model.name}`);
}
