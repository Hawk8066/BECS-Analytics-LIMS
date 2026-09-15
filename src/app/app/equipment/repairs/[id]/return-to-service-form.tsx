"use client";

import { useActionState } from "react";
import {
  returnRepairToService,
  type FormState,
} from "@/lib/actions/equipment-repair";
import { Button } from "@/components/ui/button";

/**
 * The last gate: an asset only goes back into service once IQ, OQ and PQ have
 * all passed for this repair (BR-EQ-6). When it cannot yet, the button stays
 * disabled and says what is missing rather than failing on submit.
 */
export function ReturnToServiceForm({
  repairId,
  ready,
  reason,
}: {
  repairId: string;
  ready: boolean;
  reason: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    returnRepairToService,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 border-t pt-3">
      <input type="hidden" name="repairId" value={repairId} />
      <Button type="submit" size="sm" disabled={!ready || pending}>
        {pending ? "Returning…" : "Return to service"}
      </Button>
      {!ready && <span className="text-sm text-muted-foreground">{reason}</span>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
