"use client";

import { useActionState } from "react";
import { createVendor, type FormState } from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FIELD_OPTIONS = [
  "Equipment",
  "Chemicals",
  "Glassware",
  "Equipment Supplies",
  "Office Supplies",
  "Lab Supplies",
  "PPE",
  "CRM",
  "Calibration",
  "Equipment Repair",
];

function Text({ name, label }: { name: string; label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} />
    </div>
  );
}

export function VendorForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createVendor,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="contactNumber" label="Contact number" />
        <Text name="accountNumber" label="Account number" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Text name="ntn" label="NTN" />
        <Text name="stn" label="STN" />
        <div className="grid gap-2">
          <Label htmlFor="employees"># Employees</Label>
          <Input id="employees" name="employees" type="number" min="0" />
        </div>
      </div>
      <fieldset className="grid grid-cols-2 gap-1 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Fields supplied</legend>
        {FIELD_OPTIONS.map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fields" value={f} />
            {f}
          </label>
        ))}
      </fieldset>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register vendor"}
        </Button>
      </div>
    </form>
  );
}
