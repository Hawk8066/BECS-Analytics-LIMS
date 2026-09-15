"use client";

import { useActionState, useEffect } from "react";
import {
  submitRepairInspection,
  type FormState,
} from "@/lib/actions/equipment-repair";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function InspectForm({
  repairId,
  onDone,
}: {
  repairId: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitRepairInspection,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="repairId" value={repairId} />
      <p className="text-sm text-muted-foreground">
        Rejecting sends the case back to the vendor — the asset goes out again on
        a new gate pass.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="ins-decision">Decision</Label>
        <select
          id="ins-decision"
          name="decision"
          defaultValue="ACCEPTED"
          className={SELECT_CLASS}
        >
          <option value="ACCEPTED">Accepted — the work is good</option>
          <option value="REJECTED">Rejected — send it back</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ins-note">Findings</Label>
        <Textarea id="ins-note" name="note" rows={3} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Record inspection"}
        </Button>
      </div>
    </form>
  );
}
