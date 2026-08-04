"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createOutsourceLab, type FormState } from "@/lib/actions/outsource-labs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Text({ name, label }: { name: string; label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} />
    </div>
  );
}

export function OutsourceLabForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createOutsourceLab,
    {},
  );

  if (state.ok && state.tempPassword) {
    return (
      <div className="max-w-xl space-y-4 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Outsource lab registered ✓</p>
        <p className="text-sm text-green-900">
          A portal login was created for the lab&apos;s representative. Share these
          one-time credentials — the password is shown only now.
        </p>
        <div className="rounded-md border bg-white p-3 font-mono text-sm">
          <div>Login URL: /outsource</div>
          <div>Email: {state.loginEmail}</div>
          <div>Temporary password: {state.tempPassword}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/app/outsource-labs" className={buttonVariants()}>
            Done
          </Link>
          <Link
            href="/app/outsource-labs/new"
            className={buttonVariants({ variant: "outline" })}
          >
            Register another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Lab name</Label>
        <Input id="name" name="name" required />
      </div>

      <fieldset className="grid gap-4 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Address</legend>
        <Text name="addressLine1" label="Address line 1" />
        <Text name="addressLine2" label="Address line 2" />
        <Text name="addressLine3" label="Address line 3" />
        <div className="grid grid-cols-3 gap-4">
          <Text name="city" label="City" />
          <Text name="province" label="Province" />
          <Text name="country" label="Country" />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Focal person</legend>
        <div className="grid grid-cols-2 gap-4">
          <Text name="contactPerson" label="Name" />
          <Text name="contactNumber" label="Contact number" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email (representative login)</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </fieldset>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register lab"}
        </Button>
      </div>
    </form>
  );
}
