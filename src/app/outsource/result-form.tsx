"use client";

import { useActionState } from "react";
import { enterOutsourcedResult, type FormState } from "@/lib/actions/testing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One row's result entry for the outsource-lab representative: the result value
// and the lab's own report/certificate number (the raw record reference).
export function OutsourceResultForm({
  sampleParameterId,
}: {
  sampleParameterId: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    enterOutsourcedResult,
    {},
  );

  return (
    <form
      action={formAction}
      className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="sampleParameterId" value={sampleParameterId} />
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Result</label>
        <Input name="resultValue" required placeholder="value" />
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Report #</label>
        <Input name="reportNo" required placeholder="your lab report no." />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Submit result"}
      </Button>
      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>
      )}
    </form>
  );
}
