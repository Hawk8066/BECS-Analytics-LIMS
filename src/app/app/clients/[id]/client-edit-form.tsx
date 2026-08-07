"use client";

import { useActionState, useState } from "react";
import { updateClient, type FormState } from "@/lib/actions/clients";
import { PROVINCES, CITIES, COUNTRIES } from "../client-form";
import { SECTORS } from "@/lib/sectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrOther } from "@/components/ui/select-or-other";

export interface ClientValues {
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
  sector: string | null;
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
  value: string | null;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={value ?? ""} />
    </div>
  );
}

export function ClientEditForm({ client }: { client: ClientValues }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateClient,
    {},
  );
  const knownSector = !!client.sector && SECTORS.includes(client.sector);
  const [sector, setSector] = useState(
    client.sector ? (knownSector ? client.sector : "Other") : "",
  );
  const otherDefault = !knownSector && client.sector ? client.sector : "";

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="clientId" value={client.id} />
      <div className="grid gap-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="company"
          defaultValue={client.company}
          required
        />
      </div>
      <div className="grid gap-2">
        <Text name="addressLine1" label="Address line 1" value={client.addressLine1} />
        <Text name="addressLine2" label="Address line 2" value={client.addressLine2} />
        <Text name="addressLine3" label="Address line 3" value={client.addressLine3} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SelectOrOther
          name="city"
          label="City"
          options={CITIES}
          defaultValue={client.city ?? ""}
        />
        <SelectOrOther
          name="province"
          label="Province"
          options={PROVINCES}
          defaultValue={client.province ?? ""}
        />
        <SelectOrOther
          name="country"
          label="Country"
          options={COUNTRIES}
          defaultValue={client.country ?? "Pakistan"}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="contactPerson" label="Contact person" value={client.contactPerson} />
        <Text name="contactNumber" label="Contact number" value={client.contactNumber} />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
            <Input
              name="sectorOther"
              defaultValue={otherDefault}
              placeholder="Specify sector"
            />
          )}
        </div>
        <div />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Text name="ntn" label="NTN (National Tax Number)" value={client.ntn} />
        <Text name="stn" label="STN (Sales Tax Number)" value={client.stn} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Saved ✓</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
