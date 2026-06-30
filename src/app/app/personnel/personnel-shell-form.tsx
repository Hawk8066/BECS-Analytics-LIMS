"use client";

import { useActionState } from "react";
import { createPersonnelShell, type FormState } from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

type Option = { id: string; name: string };

export function PersonnelShellForm({
  facilities,
  sections,
  designations,
}: {
  facilities: Option[];
  sections: { id: string; name: string; facilityId: string }[];
  designations: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPersonnelShell,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactNumber">Contact number</Label>
        <Input id="contactNumber" name="contactNumber" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="designation">Designation</Label>
        <select
          id="designation"
          name="designation"
          required
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Select…
          </option>
          {designations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="facilityId">Facility</Label>
          <select
            id="facilityId"
            name="facilityId"
            required
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sectionId">Section</Label>
          <select
            id="sectionId"
            name="sectionId"
            required
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dateOfJoining">Date of joining</Label>
          <DateInput id="dateOfJoining" name="dateOfJoining" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tempPassword">Temporary password</Label>
          <Input id="tempPassword" name="tempPassword" type="text" required />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create personnel shell"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The new user signs in with the temporary password to complete their
        profile; the COO then approves to activate the account.
      </p>
    </form>
  );
}
