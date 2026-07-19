"use client";

import { useActionState, useMemo, useState } from "react";
import { createQuotation, type FormState } from "@/lib/actions/quotations";
import { SECTORS } from "@/lib/sectors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";

interface ParamOpt {
  id: string;
  name: string;
  unit: string | null;
  matrix: string | null;
  prices: Record<string, number>;
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

export function QuotationForm({
  clients,
  matrices,
  parameters,
  packages,
}: {
  clients: { id: string; label: string }[];
  matrices: string[];
  parameters: ParamOpt[];
  packages: PackageOpt[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createQuotation,
    {},
  );
  const [sector, setSector] = useState("");
  const [matrix, setMatrix] = useState("");
  const [params, setParams] = useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = useState<Set<string>>(new Set());

  const sectorPackages = useMemo(
    () => (sector ? packages.filter((p) => p.prices[sector] != null) : []),
    [sector, packages],
  );
  const matrixParams = useMemo(
    () => (matrix ? parameters.filter((p) => p.matrix === matrix) : []),
    [matrix, parameters],
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
          <Label htmlFor="sector">Sector (for pricing)</Label>
          <select
            id="sector"
            name="sector"
            required
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
        </div>
        <div className="grid gap-2">
          <Label htmlFor="matrix">Matrix (filters parameters)</Label>
          <select
            id="matrix"
            value={matrix}
            onChange={(e) => setMatrix(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Select matrix…</option>
            {matrices.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sector && sectorPackages.length > 0 && (
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
              <span className="ml-auto">{pkr(pkg.prices[sector])}</span>
            </label>
          ))}
        </fieldset>
      )}

      {matrix ? (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Parameters ({matrix})</legend>
          {matrixParams.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="parameterIds"
                value={p.id}
                checked={params.has(p.id)}
                onChange={() => setParams((s) => toggle(s, p.id))}
              />
              <span>{p.name}</span>
              {p.unit && <span className="text-muted-foreground">({p.unit})</span>}
              <span className="ml-auto text-muted-foreground">
                {sector ? pkr(p.prices[sector]) : "—"}
              </span>
            </label>
          ))}
          {matrixParams.length === 0 && (
            <p className="text-sm text-muted-foreground">No parameters for this matrix.</p>
          )}
        </fieldset>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Select a matrix to choose parameters.
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Total</span>
        <span className="font-semibold">{pkr(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="validUntil">Valid until</Label>
          <DateInput id="validUntil" name="validUntil" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create quotation"}
        </Button>
      </div>
    </form>
  );
}
