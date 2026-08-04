"use client";

import { useActionState, useState } from "react";
import { assignParameters, type FormState } from "@/lib/actions/testing";
import { Button } from "@/components/ui/button";

export interface AssignRow {
  id: string; // sampleParameterId
  name: string;
  unit: string | null;
  assignedToId: string | null;
  outsourceLabId: string | null;
  hasResult: boolean; // locked — result already entered
}

// Encode the current assignment as the select's value.
const pickOf = (r: AssignRow): string =>
  r.assignedToId ? `analyst:${r.assignedToId}` : r.outsourceLabId ? `lab:${r.outsourceLabId}` : "";

/**
 * Per-parameter assignment. Each parameter is routed to an internal analyst OR an
 * external (outsourced) lab; the "assign all remaining" helper fills every still-
 * empty (and unlocked) row at once. The sample advances to ASSIGNED only when
 * every parameter has a target (enforced server-side).
 */
export function AssignPanel({
  sampleId,
  parameters,
  analysts,
  labs,
}: {
  sampleId: string;
  parameters: AssignRow[];
  analysts: { id: string; name: string }[];
  labs: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    assignParameters,
    {},
  );
  // Controlled selection per row ("analyst:<id>" | "lab:<id>" | ""), seeded from
  // the current assignment.
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(parameters.map((p) => [p.id, pickOf(p)])),
  );
  const [bulk, setBulk] = useState("");

  const hasTargets = analysts.length > 0 || labs.length > 0;
  const set = (id: string, v: string) => setPicks((p) => ({ ...p, [id]: v }));
  // Fill every unlocked, still-empty row with the bulk pick.
  const applyBulk = () => {
    if (!bulk) return;
    setPicks((p) => {
      const next = { ...p };
      for (const row of parameters)
        if (!row.hasResult && !next[row.id]) next[row.id] = bulk;
      return next;
    });
  };

  const unassigned = parameters.filter((p) => !p.hasResult && !picks[p.id]).length;

  // The grouped <option>s shared by the bulk picker and every row select.
  const options = (
    <>
      <option value="">Unassigned</option>
      {analysts.length > 0 && (
        <optgroup label="Analysts">
          {analysts.map((a) => (
            <option key={a.id} value={`analyst:${a.id}`}>
              {a.name}
            </option>
          ))}
        </optgroup>
      )}
      {labs.length > 0 && (
        <optgroup label="Outsource labs">
          {labs.map((l) => (
            <option key={l.id} value={`lab:${l.id}`}>
              {l.name} (outsourced)
            </option>
          ))}
        </optgroup>
      )}
    </>
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sampleId" value={sampleId} />

      {hasTargets && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Assign all remaining to</label>
            <select
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">Select…</option>
              {analysts.length > 0 && (
                <optgroup label="Analysts">
                  {analysts.map((a) => (
                    <option key={a.id} value={`analyst:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {labs.length > 0 && (
                <optgroup label="Outsource labs">
                  {labs.map((l) => (
                    <option key={l.id} value={`lab:${l.id}`}>
                      {l.name} (outsourced)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={applyBulk} disabled={!bulk}>
            Apply
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {parameters.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {p.name}
              {p.unit && <span className="text-muted-foreground"> ({p.unit})</span>}
            </span>
            {p.hasResult ? (
              <span className="text-xs text-muted-foreground">result entered — locked</span>
            ) : (
              <select
                name={`assign_${p.id}`}
                value={picks[p.id] ?? ""}
                onChange={(e) => set(p.id, e.target.value)}
                className="h-8 w-56 rounded-md border bg-transparent px-2 text-sm"
              >
                {options}
              </select>
            )}
          </div>
        ))}
      </div>

      {!hasTargets && (
        <p className="text-sm text-amber-700">
          No active analysts or outsource labs to assign to.
        </p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !hasTargets}>
          {pending ? "Saving…" : "Save assignments"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {unassigned === 0
            ? "All parameters assigned — saving moves the sample to testing."
            : `${unassigned} parameter${unassigned === 1 ? "" : "s"} still unassigned.`}
        </span>
      </div>
    </form>
  );
}
