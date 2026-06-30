"use client";

import { useActionState } from "react";
import { addCalibration, type FormState } from "@/lib/actions/equipment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

export function CalibrationForm({ equipmentId }: { equipmentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCalibration,
    {},
  );
  return (
    <form
      action={formAction}
      className="grid gap-3 border-t pt-3 sm:grid-cols-2"
    >
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <div className="grid gap-1.5">
        <Label className="text-xs">Calibrated on</Label>
        <DateInput name="calibratedOn" required />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Valid until</Label>
        <DateInput name="validUntil" required />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Calibrated by</Label>
        <Input name="calibratedBy" placeholder="vendor / internal" />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Certificate</Label>
        <Input name="certificate" type="file" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add calibration"}
        </Button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
