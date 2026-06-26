"use client";

import { useActionState } from "react";
import { recordCompetence, type FormState } from "@/lib/actions/authorization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompetenceForm({
  subjectId,
  functions,
}: {
  subjectId: string;
  functions: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordCompetence,
    {},
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="grid gap-1.5">
        <Label htmlFor="functionId" className="text-xs">
          Function
        </Label>
        <select
          id="functionId"
          name="functionId"
          required
          defaultValue=""
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {functions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="result" className="text-xs">
          Result
        </Label>
        <Input id="result" name="result" placeholder="Pass / score" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="validUntil" className="text-xs">
          Valid until
        </Label>
        <Input id="validUntil" name="validUntil" type="date" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Record"}
      </Button>
      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-4">{state.error}</p>
      )}
    </form>
  );
}
