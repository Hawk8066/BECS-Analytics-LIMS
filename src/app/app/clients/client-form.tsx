"use client";

import { useActionState } from "react";
import { createClient, type FormState } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Text({ name, label }: { name: string; label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} />
    </div>
  );
}

export function ClientForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createClient,
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
        <Text name="contactPerson" label="Contact person" />
        <Text name="contactNumber" label="Contact number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="email" label="Email" />
        <Text name="sector" label="Sector" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register client"}
        </Button>
      </div>
    </form>
  );
}
