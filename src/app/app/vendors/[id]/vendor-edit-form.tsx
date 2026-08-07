"use client";

import { useActionState } from "react";
import { updateVendor, type FormState } from "@/lib/actions/vendors";
import { FIELD_OPTIONS } from "../vendor-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface VendorValues {
  id: string;
  company: string;
  address: string | null;
  contactNumber: string | null;
  ntn: string | null;
  stn: string | null;
  employees: number | null;
  accountNumber: string | null;
  fields: string[];
}

export function VendorEditForm({ vendor }: { vendor: VendorValues }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateVendor,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="vendorId" value={vendor.id} />
      <div className="grid gap-2">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" defaultValue={vendor.company} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" defaultValue={vendor.address ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contactNumber">Contact number</Label>
          <Input
            id="contactNumber"
            name="contactNumber"
            defaultValue={vendor.contactNumber ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="accountNumber">Account number</Label>
          <Input
            id="accountNumber"
            name="accountNumber"
            defaultValue={vendor.accountNumber ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ntn">NTN</Label>
          <Input id="ntn" name="ntn" defaultValue={vendor.ntn ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stn">STN</Label>
          <Input id="stn" name="stn" defaultValue={vendor.stn ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="employees"># Employees</Label>
          <Input
            id="employees"
            name="employees"
            type="number"
            min="0"
            defaultValue={vendor.employees ?? ""}
          />
        </div>
      </div>
      <fieldset className="grid grid-cols-2 gap-1 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Fields supplied</legend>
        {FIELD_OPTIONS.map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="fields"
              value={f}
              defaultChecked={vendor.fields.includes(f)}
            />
            {f}
          </label>
        ))}
      </fieldset>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Saved ✓</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
