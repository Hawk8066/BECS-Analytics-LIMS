"use client";

import { useActionState, useEffect, useState } from "react";
import { updatePersonnelProfile, type FormState } from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { formatDate } from "@/lib/format";

const TITLES = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof.", "Engr."];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONS = [
  "Father",
  "Mother",
  "Spouse",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Guardian",
  "Friend",
  "Other",
];

export interface ProfileValues {
  fullName: string;
  title: string;
  fatherName: string;
  dateOfBirth: string; // yyyy-mm-dd
  cnic: string;
  contactNumber: string;
  bloodGroup: string;
  emergencyContact: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  dateOfJoining: string; // yyyy-mm-dd
  skills: string;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap">{value || "—"}</span>
    </div>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}

export function ProfileSection({
  userId,
  email,
  canEdit,
  values,
}: {
  userId: string;
  email: string;
  canEdit: boolean;
  values: ProfileValues;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updatePersonnelProfile,
    {},
  );

  // Close the editor once the server confirms the save.
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  // Keep any pre-existing non-standard title selectable so a save never drops it.
  const titleOptions =
    values.title && !TITLES.includes(values.title)
      ? [values.title, ...TITLES]
      : TITLES;
  const bloodGroupOptions =
    values.bloodGroup && !BLOOD_GROUPS.includes(values.bloodGroup)
      ? [values.bloodGroup, ...BLOOD_GROUPS]
      : BLOOD_GROUPS;
  const relationOptions =
    values.emergencyContactRelation &&
    !RELATIONS.includes(values.emergencyContactRelation)
      ? [values.emergencyContactRelation, ...RELATIONS]
      : RELATIONS;

  if (!editing) {
    return (
      <Card>
        <CardContent>
          {canEdit && (
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            </div>
          )}
          <Field label="Email" value={email} />
          <Field label="Full name" value={values.fullName} />
          <Field label="Title" value={values.title} />
          <Field label="Father's name" value={values.fatherName} />
          <Field label="CNIC" value={values.cnic} />
          <Field label="Contact" value={values.contactNumber} />
          <Field label="Blood group" value={values.bloodGroup} />
          <Field label="Emergency contact name" value={values.emergencyContactName} />
          <Field label="Emergency contact relation" value={values.emergencyContactRelation} />
          <Field label="Emergency contact number" value={values.emergencyContact} />
          <Field label="Date of birth" value={formatDate(values.dateOfBirth)} />
          <Field label="Date of joining" value={formatDate(values.dateOfJoining)} />
          <Field label="Skills" value={values.skills} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="userId" value={userId} />

          <div className="grid grid-cols-[160px_1fr] items-center gap-2 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{email}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="fullName" label="Full name" defaultValue={values.fullName} />
            <div className="grid gap-1.5">
              <Label htmlFor="title">Title</Label>
              <select
                id="title"
                name="title"
                defaultValue={values.title}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">— none —</option>
                {titleOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <TextField name="fatherName" label="Father's name" defaultValue={values.fatherName} />
            <TextField name="cnic" label="CNIC" defaultValue={values.cnic} />
            <TextField name="contactNumber" label="Contact" defaultValue={values.contactNumber} />
            <div className="grid gap-1.5">
              <Label htmlFor="bloodGroup">Blood group</Label>
              <select
                id="bloodGroup"
                name="bloodGroup"
                defaultValue={values.bloodGroup}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">— none —</option>
                {bloodGroupOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              name="emergencyContactName"
              label="Emergency contact name"
              defaultValue={values.emergencyContactName}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="emergencyContactRelation">Emergency contact relation</Label>
              <select
                id="emergencyContactRelation"
                name="emergencyContactRelation"
                defaultValue={values.emergencyContactRelation}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">— none —</option>
                {relationOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              name="emergencyContact"
              label="Emergency contact number"
              defaultValue={values.emergencyContact}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <DateInput id="dateOfBirth" name="dateOfBirth" defaultValue={values.dateOfBirth} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dateOfJoining">Date of joining</Label>
              <DateInput id="dateOfJoining" name="dateOfJoining" defaultValue={values.dateOfJoining} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="skills">Skills</Label>
            <Textarea id="skills" name="skills" rows={2} defaultValue={values.skills} />
          </div>
          <p className="text-xs text-muted-foreground">
            Education, Experience, Training and Publications are managed in their own
            sections below.
          </p>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
