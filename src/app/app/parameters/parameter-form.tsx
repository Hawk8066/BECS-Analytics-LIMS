"use client";

import { useActionState, useEffect } from "react";
import { createParameter, type FormState } from "@/lib/actions/parameters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrOther } from "@/components/ui/select-or-other";

const UNITS = [
  "%",
  "mg/kg",
  "ppm",
  "mg/L",
  "g/L",
  "ppb",
  "µg/L",
  "meq/100g",
  "pH",
  "NTU",
  "mS/cm",
];

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

export function ParameterForm({ onDone }: { onDone?: () => void }) {
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
        <SelectOrOther name="unit" label="Unit" options={UNITS} />
        <SelectOrOther name="matrix" label="Matrix" options={MATRICES} />
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
        <div className="grid gap-1.5">
          <Label htmlFor="price">Price (PKR)</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" placeholder="5000" />
        </div>
      </div>
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
