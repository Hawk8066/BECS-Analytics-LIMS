"use client";

import { useActionState, useEffect, useState } from "react";
import { savePublications, type FormState } from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { YearSelect } from "./education-section";

export interface PublicationRow {
  title: string;
  journal: string;
  year: string;
  impactFactor: string;
}

export interface PublicationInput {
  title: string;
  journal: string | null;
  year: number | null;
  impactFactor: number | null;
}

function toRows(entries: PublicationInput[]): PublicationRow[] {
  return entries.map((e) => ({
    title: e.title,
    journal: e.journal ?? "",
    year: e.year ? String(e.year) : "",
    impactFactor: e.impactFactor != null ? String(e.impactFactor) : "",
  }));
}

export function PublicationSection({
  userId,
  canEdit,
  entries,
}: {
  userId: string;
  canEdit: boolean;
  entries: PublicationInput[];
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<PublicationRow[]>(toRows(entries));
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    savePublications,
    {},
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const update = (i: number, patch: Partial<PublicationRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () =>
    setRows((rs) => [...rs, { title: "", journal: "", year: "", impactFactor: "" }]);

  const json = JSON.stringify(
    rows
      .filter((r) => r.title)
      .map((r) => ({
        title: r.title,
        journal: r.journal || null,
        year: r.year ? Number(r.year) : null,
        impactFactor: r.impactFactor ? Number(r.impactFactor) : null,
      })),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Publications</CardTitle>
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
            <p className="text-sm text-muted-foreground">No publications recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {entries.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.title}</span>
                  <span className="text-muted-foreground">
                    {e.journal ? ` — ${e.journal}` : ""}
                    {e.year ? ` (${e.year})` : ""}
                    {e.impactFactor != null ? ` · IF ${e.impactFactor}` : ""}
                  </span>
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
                className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_100px_110px_auto]"
              >
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Title</label>
                  <Input
                    value={r.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Publication title"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Journal</label>
                  <Input
                    value={r.journal}
                    onChange={(e) => update(i, { journal: e.target.value })}
                    placeholder="Journal / venue"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Year</label>
                  <YearSelect value={r.year} onChange={(v) => update(i, { year: v })} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Impact factor</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={r.impactFactor}
                    onChange={(e) => update(i, { impactFactor: e.target.value })}
                    placeholder="e.g. 3.45"
                  />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                  Remove
                </Button>
              </div>
            ))}

            <Button type="button" size="sm" variant="outline" onClick={add}>
              + Add publication
            </Button>

            {state.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex gap-2 border-t pt-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save publications"}
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
