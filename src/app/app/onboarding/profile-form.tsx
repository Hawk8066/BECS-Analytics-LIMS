"use client";

import { useActionState } from "react";
import { completeOwnProfile, type FormState } from "@/lib/actions/personnel";
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

export function ProfileForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    completeOwnProfile,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Text name="title" label="Title" />
        <Text name="fatherName" label="Father's name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>
        <Text name="cnic" label="CNIC" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="contactNumber" label="Contact number" />
        <Text name="bloodGroup" label="Blood group" />
      </div>
      <Text name="emergencyContact" label="Emergency contact" />
      <div className="grid gap-2">
        <Label htmlFor="education">Education</Label>
        <Textarea id="education" name="education" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="experience">Experience</Label>
        <Textarea id="experience" name="experience" />
      </div>
      <Text name="publications" label="Publications" />
      <Text name="trainings" label="Trainings" />
      <Text name="skills" label="Skills" />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit for COO approval"}
        </Button>
      </div>
    </form>
  );
}
