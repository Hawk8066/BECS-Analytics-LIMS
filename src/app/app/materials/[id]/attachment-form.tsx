"use client";

import { useActionState } from "react";
import { addMaterialAttachment, type FormState } from "@/lib/actions/materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MaterialAttachmentForm({
  materialId,
  kinds,
}: {
  materialId: string;
  kinds: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addMaterialAttachment,
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 border-t pt-3"
    >
      <input type="hidden" name="materialId" value={materialId} />
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Kind</label>
        <select
          name="kind"
          defaultValue={kinds[0]}
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">File</label>
        <Input name="file" type="file" />
      </div>
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
