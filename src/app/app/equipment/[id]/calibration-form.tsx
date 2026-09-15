"use client";

import { useActionState, useEffect } from "react";
import { addCalibration, type FormState } from "@/lib/actions/equipment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { CalibratorSelect, type VendorOption } from "../calibrator-select";

export function CalibrationForm({
  equipmentId,
  vendors,
  onDone,
}: {
  equipmentId: string;
  vendors: VendorOption[];
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCalibration,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <div className="grid gap-1.5">
        <Label className="text-xs">Calibrated on</Label>
        <DateInput name="calibratedOn" required />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Valid until</Label>
        <DateInput name="validUntil" required />
      </div>
      <CalibratorSelect vendors={vendors} labelClassName="text-xs" />
      <div className="grid gap-1.5">
        <Label className="text-xs" htmlFor="certificateNo">
          Certificate number
        </Label>
        <Input id="certificateNo" name="certificateNo" placeholder="e.g. CAL-2026-0142" />
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
