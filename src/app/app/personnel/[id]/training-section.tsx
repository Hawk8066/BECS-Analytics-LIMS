"use client";

import { useActionState, useEffect, useState } from "react";
import { saveTrainings, type FormState } from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { YearSelect } from "./education-section";

export interface TrainingRow {
  title: string;
  year: string;
}

export interface TrainingInput {
  title: string;
  year: number | null;
}

function toRows(entries: TrainingInput[]): TrainingRow[] {
  return entries.map((e) => ({ title: e.title, year: e.year ? String(e.year) : "" }));
}

export function TrainingSection({
  userId,
  canEdit,
  entries,
}: {
  userId: string;
  canEdit: boolean;
  entries: TrainingInput[];
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<TrainingRow[]>(toRows(entries));
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveTrainings,
    {},
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const update = (i: number, patch: Partial<TrainingRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () => setRows((rs) => [...rs, { title: "", year: "" }]);

  const json = JSON.stringify(
    rows
      .filter((r) => r.title)
      .map((r) => ({ title: r.title, year: r.year ? Number(r.year) : null })),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Training</CardTitle>
        {canEdit && !editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRows(toRows(entries));
              setEditing(true);
            }}
          >
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No training recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {entries.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{e.title}</span>
                  {e.year && <span className="text-muted-foreground">({e.year})</span>}
                </li>
              ))}
            </ul>
          )
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="entriesJson" value={json} />

            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No entries — add one below.</p>
            )}

            {rows.map((r, i) => (
              <div
                key={i}
                className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[1fr_110px_auto]"
              >
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Title</label>
                  <Input
                    value={r.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Training / course title"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Year</label>
                  <YearSelect value={r.year} onChange={(v) => update(i, { year: v })} />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                  Remove
                </Button>
              </div>
            ))}

            <Button type="button" size="sm" variant="outline" onClick={add}>
              + Add training
            </Button>

            {state.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex gap-2 border-t pt-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save training"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
