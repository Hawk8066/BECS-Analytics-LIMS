"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createStandard,
  setStandardLimit,
  removeStandardLimit,
  deleteStandard,
  type FormState,
} from "@/lib/actions/standards";
import { limitText } from "@/lib/conformity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

export interface ParamOpt {
  id: string;
  name: string;
  matrix: string | null;
  unit: string | null;
}

export interface StandardLimitData {
  id: string;
  parameterId: string;
  parameterName: string;
  matrix: string | null;
  unit: string | null;
  min: number | null;
  max: number | null;
}

export interface StandardData {
  id: string;
  name: string;
  matrix: string | null;
  description: string | null;
  limits: StandardLimitData[];
}

function StandardCard({
  std,
  parameters,
  canManage,
}: {
  std: StandardData;
  parameters: ParamOpt[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  // Parameters not yet limited by this standard — the pool for "Add limit".
  const limited = new Set(std.limits.map((l) => l.parameterId));
  const available = parameters.filter((p) => !limited.has(p.id));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            {std.name}
            {std.matrix && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {std.matrix}
              </span>
            )}
          </CardTitle>
          {std.description && (
            <p className="text-xs text-muted-foreground">{std.description}</p>
          )}
        </div>
        {canManage && (
          <form
            action={deleteStandard}
            onSubmit={(e) => {
              if (!confirm(`Delete standard "${std.name}"?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="standardId" value={std.id} />
            <Button size="sm" variant="ghost" type="submit" className="text-red-600">
              Delete
            </Button>
          </form>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {std.limits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No limits set.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-1.5 font-medium">Parameter</th>
                  <th className="px-3 py-1.5 font-medium">Acceptance limit</th>
                  {canManage && <th className="px-3 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {std.limits.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{l.parameterName}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {limitText(l.min, l.max, l.unit) || "—"}
                    </td>
                    {canManage && (
                      <td className="px-3 py-1.5 text-right">
                        <form action={removeStandardLimit}>
                          <input type="hidden" name="limitId" value={l.id} />
                          <Button
                            size="sm"
                            variant="ghost"
                            type="submit"
                            className="h-7 text-red-600"
                          >
                            Remove
                          </Button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && available.length > 0 && (
          <div>
            {adding ? (
              <form
                action={setStandardLimit}
                className="flex flex-wrap items-end gap-2 rounded-md border p-3"
              >
                <input type="hidden" name="standardId" value={std.id} />
                <div className="grid gap-1">
                  <Label className="text-xs">Parameter</Label>
                  <select
                    name="parameterId"
                    required
                    defaultValue=""
                    className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {available.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.unit ? ` (${p.unit})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Min (≥)</Label>
                  <Input
                    name="min"
                    type="number"
                    step="any"
                    placeholder="—"
                    className="h-8 w-24"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Max (≤)</Label>
                  <Input
                    name="max"
                    type="number"
                    step="any"
                    placeholder="—"
                    className="h-8 w-24"
                  />
                </div>
                <Button size="sm" type="submit">
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                Add limit
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateStandard({
  parameters,
  onDone,
}: {
  parameters: ParamOpt[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStandard,
    {},
  );
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const matrices = useMemo(
    () =>
      [...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m))].sort(),
    [parameters],
  );

  // Group the parameter picker by matrix, filtered by the matrix search box.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? parameters.filter((p) => p.matrix?.toLowerCase().includes(q))
      : parameters;
    const m = new Map<string, ParamOpt[]>();
    for (const p of [...matches].sort(
      (a, b) =>
        (a.matrix ?? "~").localeCompare(b.matrix ?? "~") ||
        a.name.localeCompare(b.name),
    )) {
      const key = p.matrix || "— (no matrix)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return [...m.entries()];
  }, [parameters, query]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="std-name">Standard name</Label>
          <Input
            id="std-name"
            name="name"
            placeholder="e.g. PSQCA Fertilizer"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="std-matrix">Matrix (filing label)</Label>
          <select
            id="std-matrix"
            name="matrix"
            defaultValue=""
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— none —</option>
            {matrices.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="std-desc">Description (optional)</Label>
        <Input id="std-desc" name="description" placeholder="e.g. PS 4900:2017" />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Parameter limits</Label>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search matrix…"
            aria-label="Search parameters by matrix"
            className="h-8 w-52"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Tick a parameter and give it a min (≥), a max (≤), or both. Ticked
          parameters with no bound are ignored.
        </p>
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-3">
          {groups.map(([matrix, list]) => (
            <div key={matrix}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {matrix} ({list.length})
              </p>
              <div className="space-y-1.5">
                {list.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex min-w-40 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        name="parameterIds"
                        value={p.id}
                        checked={!!checked[p.id]}
                        onChange={(e) =>
                          setChecked((c) => ({ ...c, [p.id]: e.target.checked }))
                        }
                        className="size-4"
                      />
                      <span>
                        {p.name}
                        {p.unit ? (
                          <span className="text-muted-foreground"> ({p.unit})</span>
                        ) : null}
                      </span>
                    </label>
                    <Input
                      name={`limit_${p.id}_min`}
                      type="number"
                      step="any"
                      placeholder="Min ≥"
                      disabled={!checked[p.id]}
                      className="h-8 w-24"
                    />
                    <Input
                      name={`limit_${p.id}_max`}
                      type="number"
                      step="any"
                      placeholder="Max ≤"
                      disabled={!checked[p.id]}
                      className="h-8 w-24"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matrix matches “{query.trim()}”.
            </p>
          )}
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create standard"}
        </Button>
      </div>
    </form>
  );
}

export function Standards({
  parameters,
  standards,
  canManage,
}: {
  parameters: ParamOpt[];
  standards: StandardData[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Acceptance standards for conforming client samples — the same product can be
          conformed against different standards.
        </p>
        {canManage && <Button onClick={() => setCreating(true)}>New standard</Button>}
      </div>
      {standards.map((std) => (
        <StandardCard
          key={std.id}
          std={std}
          parameters={parameters}
          canManage={canManage}
        />
      ))}
      {standards.length === 0 && (
        <p className="text-sm text-muted-foreground">No standards yet.</p>
      )}
      {creating && (
        <Modal
          title="New standard"
          onClose={() => setCreating(false)}
          className="max-w-3xl"
        >
          <CreateStandard parameters={parameters} onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
