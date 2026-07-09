"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createClient, type FormState } from "@/lib/actions/clients";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { SECTORS } from "@/lib/sectors";

const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
  "Islamabad Capital Territory",
];

const CITIES = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Rahim Yar Khan",
  "Bahawalpur",
  "Sargodha",
  "Sahiwal",
  "Sukkur",
];

const COUNTRIES = [
  "Pakistan",
  "Afghanistan",
  "Bangladesh",
  "China",
  "India",
  "Iran",
  "Saudi Arabia",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
];


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
  const [sector, setSector] = useState("");

  // On success we show the one-time portal credentials to hand to the client.
  if (state.ok && state.tempPassword) {
    return (
      <div className="max-w-xl space-y-4 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Client registered ✓</p>
        <p className="text-sm text-green-900">
          A portal login was created. Share these one-time credentials with the
          client — the password is shown only now.
        </p>
        <div className="rounded-md border bg-white p-3 font-mono text-sm">
          <div>Login URL: /portal</div>
          <div>Email: {state.loginEmail}</div>
          <div>Temporary password: {state.tempPassword}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/app/clients" className={buttonVariants()}>
            Done
          </Link>
          <Link href="/app/clients/new" className={buttonVariants({ variant: "outline" })}>
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
        <Text name="addressLine1" label="Address line 1" />
        <Text name="addressLine2" label="Address line 2" />
        <Text name="addressLine3" label="Address line 3" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SelectOrOther name="city" label="City" options={CITIES} />
        <SelectOrOther name="province" label="Province" options={PROVINCES} />
        <SelectOrOther name="country" label="Country" options={COUNTRIES} defaultValue="Pakistan" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="contactPerson" label="Contact person" />
        <Text name="contactNumber" label="Contact number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email (client login)</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sector">Sector</Label>
          <select
            id="sector"
            name="sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Select…</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
          {sector === "Other" && (
            <Input name="sectorOther" placeholder="Specify sector" />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="ntn" label="NTN (National Tax Number)" />
        <Text name="stn" label="STN (Sales Tax Number)" />
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
