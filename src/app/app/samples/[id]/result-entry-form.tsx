"use client";

import { useActionState } from "react";
import { enterResult, type FormState } from "@/lib/actions/testing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResultEntryForm({
  sampleParameterId,
  parameterName,
  unit,
  hasResult,
}: {
  sampleParameterId: string;
  parameterName: string;
  /** The unit registered for this test (a lone "-" means dimensionless). */
  unit?: string | null;
  hasResult: boolean;
}) {
  const showUnit = unit && unit.trim() && unit.trim() !== "-";
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    enterResult,
    {},
  );

  return (
    <form
      action={formAction}
      className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
    >
      <input type="hidden" name="sampleParameterId" value={sampleParameterId} />
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">
          {parameterName} — result{showUnit ? ` (${unit})` : ""}
        </label>
        <Input name="resultValue" required placeholder={showUnit ? String(unit) : "value"} />
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Register #</label>
        <div className="flex h-8 items-center rounded-lg border border-input bg-transparent pl-2.5 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="whitespace-nowrap text-muted-foreground">BECS/RG/</span>
          <input
            name="registerNo"
            required
            inputMode="numeric"
            pattern="[0-9]+"
            placeholder="12"
            aria-label="Register number"
            className="w-14 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Page #</label>
        <Input
          name="pageNo"
          required
          inputMode="numeric"
          placeholder="e.g. 45"
          className="w-20"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : hasResult ? "Update" : "Save"}
      </Button>
      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-4">{state.error}</p>
      )}
    </form>
  );
}
