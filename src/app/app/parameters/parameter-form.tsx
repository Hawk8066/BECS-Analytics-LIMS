"use client";

import { useActionState, useEffect } from "react";
import { createParameter, type FormState } from "@/lib/actions/parameters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { UNITS } from "@/lib/units";

// Fallback only — the page passes the matrices actually in use, so a new
// parameter files under one of those rather than inventing a near-duplicate
// ("Fertilizer" when the master list says "Fertilizer - Solid").
const MATRICES = [
  "Fertilizer",
  "Soil",
  "Water",
  "Wastewater",
  "Compost",
  "Plant / Tissue",
  "Feed",
  "Food",
  "Chemical",
];

export function ParameterForm({
  matrices,
  units,
  onDone,
}: {
  matrices?: string[];
  units?: string[];
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createParameter,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="grid gap-4 border-t pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Parameter</Label>
          <Input id="name" name="name" placeholder="e.g. Phosphorus" required />
        </div>
        <SelectOrOther name="unit" label="Unit" options={units?.length ? units : UNITS} />
        <SelectOrOther
          name="matrix"
          label="Matrix"
          options={matrices?.length ? matrices : MATRICES}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="method">Method</Label>
          <Input id="method" name="method" placeholder="e.g. AOAC 965.09" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lod">LOD</Label>
          <Input id="lod" name="lod" placeholder="Limit of detection" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="loq">LOQ</Label>
          <Input id="loq" name="loq" placeholder="Limit of quantification" />
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
        <legend className="px-1 text-sm font-medium">Normal / urgent</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="price">Price, normal (PKR)</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" placeholder="optional" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="urgentPrice">Price, urgent (PKR)</Label>
          <Input
            id="urgentPrice"
            name="urgentPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="normal +50%"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tatDays">TAT, normal (days)</Label>
          <Input id="tatDays" name="tatDays" type="number" min="0" step="1" placeholder="e.g. 5" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tatUrgentDays">TAT, urgent (days)</Label>
          <Input
            id="tatUrgentDays"
            name="tatUrgentDays"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 2"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-4">
          One price per parameter; you can revise it later on the Prices tab. Leave the
          urgent price blank to charge rush work at normal +50%.
        </p>
      </fieldset>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="accredited" className="size-4" />
          Accredited
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add parameter"}
        </Button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
