"use client";

import { useActionState, useEffect, useState } from "react";
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
  referenceClientId: string | null;
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

export function ThirdPartyForm({
  initial,
  clients,
  onSaved,
}: {
  initial?: ThirdPartyValues;
  /** Clients this third party can be associated with (the reference client). */
  clients: { id: string; label: string; sector: string | null }[];
  /** Modal mode: called after a successful create (e.g. to close the popup). */
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    initial ? updateThirdParty : createThirdParty,
    {},
  );

  // Sector filters which clients the reference-client picker offers.
  const [sector, setSector] = useState("");
  const [referenceClientId, setReferenceClientId] = useState(
    initial?.referenceClientId ?? "",
  );
  const sectorOptions = [
    ...new Set(clients.map((c) => c.sector).filter((s): s is string => !!s)),
  ].sort();
  const visibleClients = sector
    ? clients.filter((c) => c.sector === sector)
    : clients;

  // In popup mode, close on a successful create instead of showing the panel.
  useEffect(() => {
    if (!initial && state.ok && onSaved) onSaved();
  }, [state.ok, initial, onSaved]);

  if (!initial && state.ok && !onSaved) {
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
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="tp-sector">Sector</Label>
          <select
            id="tp-sector"
            value={sector}
            onChange={(e) => {
              const s = e.target.value;
              setSector(s);
              // Drop the picked client if the new sector no longer shows it.
              if (
                referenceClientId &&
                s &&
                !clients.some(
                  (c) => c.id === referenceClientId && c.sector === s,
                )
              )
                setReferenceClientId("");
            }}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">All sectors</option>
            {sectorOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="referenceClientId">Reference client</Label>
          <select
            id="referenceClientId"
            name="referenceClientId"
            value={referenceClientId}
            onChange={(e) => setReferenceClientId(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— none —</option>
            {visibleClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        The client who asks reports to be issued in this third party&apos;s name.
        Pick a sector to narrow the list.
      </p>
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
