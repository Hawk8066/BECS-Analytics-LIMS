"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveEducation,
  uploadEducationFile,
  type FormState,
} from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadButton } from "@/components/ui/file-upload-button";

const DEGREE_LEVELS = [
  "Matriculation",
  "Intermediate / A-Level",
  "Diploma",
  "Certificate",
  "Bachelor's",
  "Master's",
  "MPhil",
  "PhD",
  "Post-Doc",
  "Other",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1960 + 1 }, (_, i) => CURRENT_YEAR - i);

export interface EducationRow {
  id: string; // "" for a new (unsaved) row
  degreeLevel: string;
  subjects: string;
  startYear: string; // "" or e.g. "2018"
  endYear: string;
}

export interface EducationInput {
  id: string;
  degreeLevel: string;
  subjects: string | null;
  startYear: number | null;
  endYear: number | null;
  degreeAttId?: string | null;
  transcriptAttId?: string | null;
}

function toRows(entries: EducationInput[]): EducationRow[] {
  return entries.map((e) => ({
    id: e.id,
    degreeLevel: e.degreeLevel,
    subjects: e.subjects ?? "",
    startYear: e.startYear ? String(e.startYear) : "",
    endYear: e.endYear ? String(e.endYear) : "",
  }));
}

export function YearSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
    >
      <option value="">Year</option>
      {YEARS.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}

export function EducationSection({
  userId,
  canEdit,
  entries,
}: {
  userId: string;
  canEdit: boolean;
  entries: EducationInput[];
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EducationRow[]>(toRows(entries));
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveEducation,
    {},
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const update = (i: number, patch: Partial<EducationRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () =>
    setRows((rs) => [
      ...rs,
      { id: "", degreeLevel: "", subjects: "", startYear: "", endYear: "" },
    ]);

  const json = JSON.stringify(
    rows
      .filter((r) => r.degreeLevel)
      .map((r) => ({
        id: r.id || null,
        degreeLevel: r.degreeLevel,
        subjects: r.subjects || null,
        startYear: r.startYear ? Number(r.startYear) : null,
        endYear: r.endYear ? Number(r.endYear) : null,
      })),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Education</CardTitle>
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
            <p className="text-sm text-muted-foreground">No education recorded.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {entries.map((e) => (
                <li key={e.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{e.degreeLevel}</span>
                    {e.subjects && <span className="text-muted-foreground">— {e.subjects}</span>}
                    {(e.startYear || e.endYear) && (
                      <span className="text-muted-foreground">
                        ({e.startYear ?? "?"}–{e.endYear ?? "present"})
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    {(["DEGREE", "TRANSCRIPT"] as const).map((kind) => {
                      const attId =
                        kind === "DEGREE" ? e.degreeAttId : e.transcriptAttId;
                      return (
                        <div key={kind} className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-muted-foreground">
                              {kind === "DEGREE" ? "Degree" : "Transcript"}
                            </span>
                            {attId ? (
                              <a
                                href={`/api/files/${attId}`}
                                target="_blank"
                                rel="noopener"
                                className="underline"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-muted-foreground">— none</span>
                            )}
                          </div>
                          {canEdit && (
                            <FileUploadButton
                              action={uploadEducationFile}
                              hidden={{ entryId: e.id, kind }}
                              label={attId ? "Replace" : "Upload"}
                              accept="image/*,application/pdf"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_90px_90px_auto]"
              >
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Degree level</label>
                  <select
                    value={r.degreeLevel}
                    onChange={(e) => update(i, { degreeLevel: e.target.value })}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {DEGREE_LEVELS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Subject(s)</label>
                  <Input
                    value={r.subjects}
                    onChange={(e) => update(i, { subjects: e.target.value })}
                    placeholder="e.g. Chemistry"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Start</label>
                  <YearSelect value={r.startYear} onChange={(v) => update(i, { startYear: v })} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">End</label>
                  <YearSelect value={r.endYear} onChange={(v) => update(i, { endYear: v })} />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                  Remove
                </Button>
              </div>
            ))}

            <Button type="button" size="sm" variant="outline" onClick={add}>
              + Add education
            </Button>
            <p className="text-xs text-muted-foreground">
              Save first, then upload the degree &amp; transcript for each entry.
            </p>

            {state.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex gap-2 border-t pt-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save education"}
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
