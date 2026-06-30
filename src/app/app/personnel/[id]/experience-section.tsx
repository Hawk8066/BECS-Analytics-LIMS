"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveExperience, type FormState } from "@/lib/actions/personnel";
import { formatDate, maskDMY, dmyToISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "@/components/ui/date-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ExperienceRow {
  company: string;
  designation: string;
  startDate: string; // DD/MM/YYYY display
  endDate: string;
  current: boolean; // currently working here (no end date)
}

export interface ExperienceInput {
  company: string;
  designation: string | null;
  startDate: string | null; // ISO
  endDate: string | null;
}

function toRows(entries: ExperienceInput[]): ExperienceRow[] {
  return entries.map((e) => ({
    company: e.company,
    designation: e.designation ?? "",
    startDate: formatDate(e.startDate),
    endDate: formatDate(e.endDate),
    // No end date on a started job ⇒ treat as "currently working".
    current: !e.endDate && !!e.startDate,
  }));
}

// Controlled DD/MM/YYYY text field with calendar picker (for dynamic rows).
function DMYField({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const iso = dmyToISO(value);
  const invalid = value.length > 0 && !iso;
  const nativeRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through
      }
    }
    el.focus();
    el.click();
  };

  if (disabled) {
    return <Input value="Present" disabled className="text-muted-foreground" />;
  }

  return (
    <div className="relative">
      <Input
        value={value}
        inputMode="numeric"
        placeholder={placeholder}
        className="pr-9"
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(maskDMY(e.target.value))}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <CalendarIcon />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={iso}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onChange(formatDate(e.target.value))}
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </div>
  );
}

export function ExperienceSection({
  userId,
  canEdit,
  entries,
}: {
  userId: string;
  canEdit: boolean;
  entries: ExperienceInput[];
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<ExperienceRow[]>(toRows(entries));
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveExperience,
    {},
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const update = (i: number, patch: Partial<ExperienceRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () =>
    setRows((rs) => [
      ...rs,
      { company: "", designation: "", startDate: "", endDate: "", current: false },
    ]);

  const json = JSON.stringify(
    rows
      .filter((r) => r.company)
      .map((r) => ({
        company: r.company,
        designation: r.designation || null,
        startDate: dmyToISO(r.startDate) || null,
        // "Currently working" ⇒ no end date (rendered as "present").
        endDate: r.current ? null : dmyToISO(r.endDate) || null,
      })),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Experience</CardTitle>
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
            <p className="text-sm text-muted-foreground">No experience recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {entries.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  {e.designation && <span className="font-medium">{e.designation},</span>}
                  <span>{e.company}</span>
                  {(e.startDate || e.endDate) && (
                    <span className="text-muted-foreground">
                      ({formatDate(e.startDate) || "?"} – {formatDate(e.endDate) || "present"})
                    </span>
                  )}
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
                className="grid items-start gap-x-4 gap-y-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_150px_150px_auto]"
              >
                <div className="grid min-w-0 gap-1">
                  <label className="text-xs text-muted-foreground">Company</label>
                  <Input
                    value={r.company}
                    onChange={(e) => update(i, { company: e.target.value })}
                    placeholder="Company / organization"
                  />
                </div>
                <div className="grid min-w-0 gap-1">
                  <label className="text-xs text-muted-foreground">Designation</label>
                  <Input
                    value={r.designation}
                    onChange={(e) => update(i, { designation: e.target.value })}
                    placeholder="Role / title"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Start date</label>
                  <DMYField value={r.startDate} onChange={(v) => update(i, { startDate: v })} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">End date</label>
                  <DMYField
                    value={r.endDate}
                    onChange={(v) => update(i, { endDate: v })}
                    disabled={r.current}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={r.current}
                      onChange={(e) =>
                        update(i, {
                          current: e.target.checked,
                          endDate: e.target.checked ? "" : r.endDate,
                        })
                      }
                      className="size-3.5"
                    />
                    Currently working
                  </label>
                </div>
                <div className="grid gap-1">
                  {/* spacer keeps the button aligned with the inputs above */}
                  <span className="hidden text-xs lg:block">&nbsp;</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(i)}
                    className="justify-self-start text-red-600"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" size="sm" variant="outline" onClick={add}>
              + Add experience
            </Button>

            {state.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex gap-2 border-t pt-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save experience"}
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
