"use client";

import { useActionState, useMemo, useState } from "react";
import { registerSample, type FormState } from "@/lib/actions/samples";
import { SECTORS } from "@/lib/sectors";
import { UNITS } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ParamOpt {
  id: string;
  name: string;
  unit: string | null;
  accredited: boolean;
  prices: Record<string, number>; // sector -> paisa
}
interface PackageOpt {
  id: string;
  name: string;
  parameterIds: string[];
  prices: Record<string, number>;
}

function pkr(paisa: number | undefined): string {
  return paisa != null ? `PKR ${(paisa / 100).toLocaleString("en-PK")}` : "—";
}

export function SampleForm({
  labs,
  defaultLabId,
  clients,
  parameters,
  packages,
}: {
  labs: { id: string; name: string }[];
  defaultLabId?: string;
  clients: { id: string; label: string }[];
  parameters: ParamOpt[];
  packages: PackageOpt[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerSample,
    {},
  );
  // Sector is chosen per sample (any client may request any sector).
  const [sector, setSector] = useState("");
  const [params, setParams] = useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = useState<Set<string>>(new Set());

  const sectorPackages = useMemo(
    () => (sector ? packages.filter((p) => p.prices[sector] != null) : []),
    [sector, packages],
  );

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const total = useMemo(() => {
    if (!sector) return 0;
    let t = 0;
    for (const id of pkgs) t += packages.find((p) => p.id === id)?.prices[sector] ?? 0;
    for (const id of params) t += parameters.find((p) => p.id === id)?.prices[sector] ?? 0;
    return t;
  }, [pkgs, params, sector, packages, parameters]);

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="facilityId">Lab</Label>
        <select
          id="facilityId"
          name="facilityId"
          required
          defaultValue={defaultLabId ?? ""}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
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
          <Input id="sampleType" name="sampleType" placeholder="e.g. Zabardast Urea" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="clientSampleRef">Client Sample ID</Label>
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

      <div className="grid gap-2">
        <Label htmlFor="sector">Sector (for pricing)</Label>
        <select
          id="sector"
          name="sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Select sector…</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Any client can request any sector; this drives parameter prices &amp; packages.
        </p>
      </div>

      {!sector ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Select a sector to see the parameters and packages.
        </p>
      ) : (
        <>
          {sectorPackages.length > 0 && (
            <fieldset className="grid gap-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Packages ({sector})</legend>
              {sectorPackages.map((pkg) => (
                <label key={pkg.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="packageIds"
                    value={pkg.id}
                    checked={pkgs.has(pkg.id)}
                    onChange={() => setPkgs((s) => toggle(s, pkg.id))}
                  />
                  <span className="font-medium">{pkg.name}</span>
                  <span className="text-muted-foreground">
                    ({pkg.parameterIds.length} params)
                  </span>
                  <span className="ml-auto">{pkr(pkg.prices[sector])}</span>
                </label>
              ))}
            </fieldset>
          )}

          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Parameters</legend>
            {parameters.map((p) => {
              const unitOptions =
                p.unit && !UNITS.includes(p.unit) ? [p.unit, ...UNITS] : UNITS;
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="parameterIds"
                    value={p.id}
                    checked={params.has(p.id)}
                    onChange={() => setParams((s) => toggle(s, p.id))}
                  />
                  <span>{p.name}</span>
                  {p.accredited && (
                    <span className="rounded bg-[#eaf6e2] px-1 text-xs text-[#4e8a2c]">
                      accredited
                    </span>
                  )}
                  <select
                    name={`unit_${p.id}`}
                    defaultValue={p.unit ?? ""}
                    className="ml-auto h-7 rounded-md border bg-transparent px-1 text-xs"
                    aria-label={`Unit for ${p.name}`}
                  >
                    <option value="">unit…</option>
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <span className="w-24 text-right text-muted-foreground">
                    {pkr(p.prices[sector])}
                  </span>
                </div>
              );
            })}
          </fieldset>

          <div className="flex justify-end text-sm">
            <span className="text-muted-foreground">Estimated total:&nbsp;</span>
            <span className="font-medium">{pkr(total)}</span>
          </div>
        </>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register sample"}
        </Button>
      </div>
    </form>
  );
}
