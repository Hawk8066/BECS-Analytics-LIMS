"use client";

import { useActionState } from "react";
import Link from "next/link";
import { adminSaveRecord, type FormState } from "@/lib/actions/admin";
import type { AdminField } from "@/lib/admin/registry";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface RecordFormProps {
  modelName: string;
  id?: string;
  fields: AdminField[];
  initial: Record<string, string>;
  showPasswordField?: boolean;
}

function Field({
  field,
  initial,
}: {
  field: AdminField;
  initial: string;
}) {
  const common = { id: field.name, name: field.name };

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...common}
          defaultChecked={initial === "true"}
          className="size-4"
        />
        {field.name}
        {field.isRequired && <span className="text-red-600">*</span>}
      </label>
    );
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={field.name}>
        {field.name}
        {field.isRequired && <span className="ml-0.5 text-red-600">*</span>}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {field.type}
        </span>
      </Label>

      {field.type === "enum" ? (
        <select
          {...common}
          defaultValue={initial}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          {!field.isRequired && <option value="">— none —</option>}
          {(field.enumValues ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : field.type === "json" ? (
        <Textarea {...common} defaultValue={initial} rows={3} className="font-mono text-xs" />
      ) : field.type === "datetime" ? (
        <Input type="datetime-local" {...common} defaultValue={initial} />
      ) : field.type === "int" || field.type === "float" ? (
        <Input
          type="number"
          step={field.type === "float" ? "any" : "1"}
          {...common}
          defaultValue={initial}
        />
      ) : (
        <Input {...common} defaultValue={initial} />
      )}
    </div>
  );
}

export function RecordForm({
  modelName,
  id,
  fields,
  initial,
  showPasswordField,
}: RecordFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    adminSaveRecord,
    {},
  );

  const editable = fields.filter((f) => f.editable);

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      <input type="hidden" name="__model" value={modelName} />
      <input type="hidden" name="__id" value={id ?? ""} />

      {editable.map((f) => (
        <Field key={f.name} field={f} initial={initial[f.name] ?? ""} />
      ))}

      {showPasswordField && (
        <div className="grid gap-1.5">
          <Label htmlFor="__newPassword">
            Set / reset password
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              plaintext — hashed on save; leave blank to keep current
            </span>
          </Label>
          <Input id="__newPassword" name="__newPassword" type="text" autoComplete="off" />
        </div>
      )}

      {state.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Create record"}
        </Button>
        <Link href={`/app/admin/${modelName}`} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
