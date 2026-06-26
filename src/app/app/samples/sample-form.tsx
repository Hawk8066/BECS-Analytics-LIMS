"use client";

import { useActionState } from "react";
import { registerSample, type FormState } from "@/lib/actions/samples";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SampleForm({
  clients,
  parameters,
}: {
  clients: { id: string; label: string }[];
  parameters: { id: string; name: string; unit: string | null; accredited: boolean }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerSample,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="clientId">Client</Label>
        <select
          id="clientId"
          name="clientId"
          required
          defaultValue=""
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sampleType">Sample type</Label>
          <Input
            id="sampleType"
            name="sampleType"
            placeholder="e.g. Zabardast Urea"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="clientSampleRef">Client sample ref</Label>
          <Input id="clientSampleRef" name="clientSampleRef" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="Normal"
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option>Normal</option>
            <option>Urgent</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="thirdPartyName">Third-party report name</Label>
          <Input id="thirdPartyName" name="thirdPartyName" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="instructions">Client instructions</Label>
        <Textarea id="instructions" name="instructions" />
      </div>

      <fieldset className="grid gap-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Parameters</legend>
        {parameters.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="parameterIds" value={p.id} />
            <span>{p.name}</span>
            {p.unit && <span className="text-muted-foreground">({p.unit})</span>}
            {p.accredited && (
              <span className="rounded bg-[#eaf6e2] px-1 text-xs text-[#4e8a2c]">
                accredited
              </span>
            )}
          </label>
        ))}
      </fieldset>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register sample"}
        </Button>
      </div>
    </form>
  );
}
