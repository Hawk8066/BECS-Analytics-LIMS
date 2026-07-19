"use client";

import { useActionState, useState } from "react";
import { createFunction, type FormState } from "@/lib/actions/functions";
import {
  FUNCTION_EDUCATION,
  FUNCTION_FIELDS,
  experienceOptions,
} from "@/lib/function-criteria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CheckboxGroup({
  name,
  options,
}: {
  name: string;
  options: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={name} value={o} className="size-4" />
          {o}
        </label>
      ))}
    </div>
  );
}

export function FunctionForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createFunction,
    {},
  );
  const [showOther, setShowOther] = useState(false);
  const [trainings, setTrainings] = useState<string[]>([""]);

  const setTraining = (i: number, v: string) =>
    setTrainings((ts) => ts.map((t, idx) => (idx === i ? v : t)));
  const removeTraining = (i: number) =>
    setTrainings((ts) => (ts.length === 1 ? [""] : ts.filter((_, idx) => idx !== i)));
  const addTraining = () => setTrainings((ts) => [...ts, ""]);

  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <div className="grid gap-2">
        <Label>Code</Label>
        <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm text-muted-foreground">
          BECS/602/Functions/####
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-generated on creation (e.g. BECS/602/Functions/0001).
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Run Test Method TM-014" required />
      </div>

      <div className="grid gap-2">
        <Label>Education</Label>
        <p className="text-xs text-muted-foreground">
          Acceptable degree levels (tick all that qualify).
        </p>
        <CheckboxGroup name="education" options={FUNCTION_EDUCATION} />
      </div>

      <div className="grid gap-2">
        <Label>Subject</Label>
        <p className="text-xs text-muted-foreground">
          Acceptable disciplines (tick all that qualify).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FUNCTION_FIELDS.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="field" value={o} className="size-4" />
              {o}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOther}
              onChange={(e) => setShowOther(e.target.checked)}
              className="size-4"
            />
            Others
          </label>
        </div>
        {showOther && (
          <Input
            name="fieldOther"
            placeholder="Specify other subject(s), comma-separated"
          />
        )}
      </div>

      <div className="grid gap-2">
        <Label>Training</Label>
        <p className="text-xs text-muted-foreground">
          Required trainings (add one per line).
        </p>
        <div className="grid gap-2">
          {trainings.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                name="training"
                value={t}
                onChange={(e) => setTraining(i, e.target.value)}
                placeholder="e.g. ISO/IEC 17025 Awareness"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => removeTraining(i)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={addTraining}>
            + Add training
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="minExperienceYears">Experience (minimum)</Label>
        <select
          id="minExperienceYears"
          name="minExperienceYears"
          defaultValue=""
          className="h-9 max-w-[200px] rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">No requirement</option>
          {experienceOptions().map((y) => (
            <option key={y} value={y}>
              {y} {y === 1 ? "year" : "years"}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create function"}
        </Button>
      </div>
    </form>
  );
}
