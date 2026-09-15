"use client";

import { useActionState } from "react";
import { registerMaterial, type FormState } from "@/lib/actions/materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

export function MaterialForm({
  type,
  facility,
}: {
  type: string;
  /** Lab slug this register page belongs to. */
  facility?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerMaterial,
    {},
  );
  const isCRM = type === "CRM";

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <input type="hidden" name="type" value={type} />
      {facility && <input type="hidden" name="facility" value={facility} />}
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="lotNo">Lot No</Label>
          <Input id="lotNo" name="lotNo" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="expiry">Expiry</Label>
          <DateInput id="expiry" name="expiry" />
        </div>
        {isCRM && (
          <div className="grid gap-2">
            <Label htmlFor="certifiedValue">Certified value</Label>
            <Input id="certifiedValue" name="certifiedValue" placeholder="e.g. 99.8% ± 0.2" />
          </div>
        )}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Register"}
        </Button>
      </div>
    </form>
  );
}
