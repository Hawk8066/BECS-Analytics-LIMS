"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createThirdParty,
  updateThirdParty,
  type FormState,
} from "@/lib/actions/third-parties";
import { PROVINCES, CITIES, COUNTRIES } from "../clients/client-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrOther } from "@/components/ui/select-or-other";

export interface ThirdPartyValues {
  id: string;
  company: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  contactPerson: string | null;
  contactNumber: string | null;
  email: string | null;
  ntn: string | null;
  stn: string | null;
}

function Text({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={value ?? ""} />
    </div>
  );
}

export function ThirdPartyForm({ initial }: { initial?: ThirdPartyValues }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    initial ? updateThirdParty : createThirdParty,
    {},
  );

  if (!initial && state.ok) {
    return (
      <div className="max-w-xl space-y-4 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Third party saved ✓</p>
        <div className="flex gap-2">
          <Link href="/app/third-parties" className={buttonVariants()}>
            Done
          </Link>
          <Link
            href="/app/third-parties/new"
            className={buttonVariants({ variant: "outline" })}
          >
            Add another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      {initial && <input type="hidden" name="thirdPartyId" value={initial.id} />}
      <div className="grid gap-2">
        <Label htmlFor="company">Name</Label>
        <Input
          id="company"
          name="company"
          defaultValue={initial?.company ?? ""}
          required
        />
      </div>
      <div className="grid gap-2">
        <Text name="addressLine1" label="Address line 1" value={initial?.addressLine1} />
        <Text name="addressLine2" label="Address line 2" value={initial?.addressLine2} />
        <Text name="addressLine3" label="Address line 3" value={initial?.addressLine3} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SelectOrOther
          name="city"
          label="City"
          options={CITIES}
          defaultValue={initial?.city ?? ""}
        />
        <SelectOrOther
          name="province"
          label="Province"
          options={PROVINCES}
          defaultValue={initial?.province ?? ""}
        />
        <SelectOrOther
          name="country"
          label="Country"
          options={COUNTRIES}
          defaultValue={initial?.country ?? "Pakistan"}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="contactPerson" label="Contact person" value={initial?.contactPerson} />
        <Text name="contactNumber" label="Contact number" value={initial?.contactNumber} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Text name="email" label="Email" value={initial?.email} />
        <Text name="ntn" label="NTN" value={initial?.ntn} />
        <Text name="stn" label="STN" value={initial?.stn} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {initial && state.ok && <p className="text-sm text-green-700">Saved ✓</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Save third party"}
        </Button>
      </div>
    </form>
  );
}
