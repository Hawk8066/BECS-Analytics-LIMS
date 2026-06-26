"use client";

import { useActionState } from "react";
import { enterResult, type FormState } from "@/lib/actions/testing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResultEntryForm({
  sampleParameterId,
  parameterName,
  hasResult,
}: {
  sampleParameterId: string;
  parameterName: string;
  hasResult: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    enterResult,
    {},
  );

  return (
    <form
      action={formAction}
      className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
    >
      <input type="hidden" name="sampleParameterId" value={sampleParameterId} />
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">
          {parameterName} — result
        </label>
        <Input name="resultValue" required placeholder="value" />
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Raw-data photo</label>
        <Input name="photo" type="file" accept="image/*" />
      </div>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="outOfCalibration" /> out-of-cal
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : hasResult ? "Update" : "Save"}
      </Button>
      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-4">{state.error}</p>
      )}
    </form>
  );
}
