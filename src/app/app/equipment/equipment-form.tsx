"use client";

import { useActionState } from "react";
import { registerEquipment, type FormState } from "@/lib/actions/equipment";
import { Button } from "@/components/ui/button";
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

export function EquipmentForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerEquipment,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="make" label="Make" />
        <Text name="model" label="Model" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="serialNo" label="Serial number" />
        <Text name="location" label="Location" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register equipment"}
        </Button>
      </div>
    </form>
  );
}
