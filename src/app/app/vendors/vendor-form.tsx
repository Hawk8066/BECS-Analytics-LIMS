"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createVendor, type FormState } from "@/lib/actions/vendors";
import { Button, buttonVariants } from "@/components/ui/button";
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

  if (state.ok && state.tempPassword) {
    return (
      <div className="max-w-xl space-y-4 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Vendor registered ✓</p>
        <p className="text-sm text-green-900">
          A portal login was created. Share these one-time credentials with the
          vendor — the password is shown only now.
        </p>
        <div className="rounded-md border bg-white p-3 font-mono text-sm">
          <div>Login URL: /vendor</div>
          <div>Email: {state.loginEmail}</div>
          <div>Temporary password: {state.tempPassword}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/app/vendors" className={buttonVariants()}>
            Done
          </Link>
          <Link href="/app/vendors/new" className={buttonVariants({ variant: "outline" })}>
            Register another
          </Link>
        </div>
      </div>
    );
  }

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
        <div className="grid gap-2">
          <Label htmlFor="email">Email (vendor login)</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Text name="contactNumber" label="Contact number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="accountNumber" label="Account number" />
        <div />
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
