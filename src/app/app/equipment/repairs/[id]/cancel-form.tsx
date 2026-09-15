"use client";

import { useActionState, useEffect } from "react";
import {
  cancelRepairRequest,
  type FormState,
} from "@/lib/actions/equipment-repair";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CancelForm({
  repairId,
  onDone,
}: {
  repairId: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelRepairRequest,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="repairId" value={repairId} />
      <p className="text-sm text-muted-foreground">
        Closes this case and puts the asset back in service if nothing else is
        holding it out. The purchase request is not withdrawn — reject it from
        the procurement page.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-reason">Why</Label>
        <Input id="cancel-reason" name="reason" placeholder="optional" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Cancelling…" : "Cancel repair"}
        </Button>
      </div>
    </form>
  );
}
