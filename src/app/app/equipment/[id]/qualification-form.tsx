"use client";

import { useActionState } from "react";
import { addQualification, type FormState } from "@/lib/actions/equipment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QualificationForm({ equipmentId }: { equipmentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addQualification,
    {},
  );
  return (
    <form
      action={formAction}
      className="grid gap-3 border-t pt-3 sm:grid-cols-[90px_110px_160px_auto] sm:items-end"
    >
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Type</label>
        <select
          name="type"
          defaultValue="IQ"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          {["IQ", "OQ", "PQ"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Result</label>
        <select
          name="result"
          defaultValue="PASS"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          {["PASS", "FAIL"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Date</label>
        <Input name="performedOn" type="date" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Add"}
      </Button>
      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-4">{state.error}</p>
      )}
    </form>
  );
}
