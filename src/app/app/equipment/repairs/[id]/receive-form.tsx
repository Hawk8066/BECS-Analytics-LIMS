"use client";

import { useActionState, useEffect } from "react";
import { receiveRepair, type FormState } from "@/lib/actions/equipment-repair";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReceiveForm({
  repairId,
  offSite,
  onDone,
}: {
  repairId: string;
  offSite: boolean;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    receiveRepair,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="repairId" value={repairId} />
      <p className="text-sm text-muted-foreground">
        {offSite
          ? "Closes the open gate pass and records the asset back on site. It stays out of service until it is inspected and requalified."
          : "Records that the on-site work is finished. The asset stays out of service until it is inspected and requalified."}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="rx-date">
          {offSite ? "Date received back" : "Date completed"}
        </Label>
        <DateInput id="rx-date" name="returnedOn" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rx-note">Note</Label>
        <Textarea id="rx-note" name="note" rows={2} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "Record"}
        </Button>
      </div>
    </form>
  );
}
