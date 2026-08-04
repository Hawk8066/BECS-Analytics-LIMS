"use client";

import { useActionState } from "react";
import { enterResult, type FormState } from "@/lib/actions/production-qc";
import { Button } from "@/components/ui/button";

export function ResultForm({ lotId, unit }: { lotId: string; unit: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    enterResult,
    {},
  );
  return (
    <form action={formAction} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="lotId" value={lotId} />
      <input
        name="resultValue"
        type="number"
        step="0.01"
        required
        placeholder={`value ${unit}`}
        className="h-8 w-24 rounded-md border bg-transparent px-2 text-sm"
      />
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
