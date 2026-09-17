"use client";

import { useActionState } from "react";
import { completeOwnProfile, type FormState } from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";

/**
 * Every field reads its value back from `state.values`.
 *
 * React 19 resets an uncontrolled form once its action completes, so on a
 * rejected submit (a duplicate CNIC, say) the inputs would otherwise come back
 * blank and this twelve-field form would have to be retyped. Echoing the
 * submitted values back as defaults makes the error recoverable in place, which
 * is the whole point of reporting it inline.
 */
function Text({
  name,
  label,
  state,
}: {
  name: string;
  label: string;
  state: FormState;
}) {
  const invalid = state.field === name;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={state.values?.[name] ?? ""}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "form-error" : undefined}
      />
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
      {/* The error sits at the top, not above the submit button: this form is
          long enough that a message at the bottom can land below the fold. */}
      {state.error && (
        <p
          id="form-error"
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Text name="title" label="Title" state={state} />
        <Text name="fatherName" label="Father's name" state={state} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <DateInput
            id="dateOfBirth"
            name="dateOfBirth"
            defaultValue={state.values?.dateOfBirth ?? ""}
          />
        </div>
        <Text name="cnic" label="CNIC" state={state} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="contactNumber" label="Contact number" state={state} />
        <Text name="bloodGroup" label="Blood group" state={state} />
      </div>
      <Text name="emergencyContact" label="Emergency contact" state={state} />
      <div className="grid gap-2">
        <Label htmlFor="education">Education</Label>
        <Textarea
          id="education"
          name="education"
          defaultValue={state.values?.education ?? ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="experience">Experience</Label>
        <Textarea
          id="experience"
          name="experience"
          defaultValue={state.values?.experience ?? ""}
        />
      </div>
      <Text name="publications" label="Publications" state={state} />
      <Text name="trainings" label="Trainings" state={state} />
      <Text name="skills" label="Skills" state={state} />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit for COO approval"}
        </Button>
      </div>
    </form>
  );
}
