"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerEquipment, type FormState } from "@/lib/actions/equipment";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalibratorSelect, type VendorOption } from "./calibrator-select";

export type EquipmentItem = {
  id: string;
  name: string;
  code: string | null;
  make: string | null;
  model: string | null;
  /** Sub-store holding it — only shown when the lab has more than one. */
  storeName: string;
  /** Already on the equipment register — shown, but not selectable twice. */
  registered: boolean;
};

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function EquipmentForm({
  items,
  vendors,
  storeHref,
  multipleStores,
}: {
  items: EquipmentItem[];
  /** Registered vendors, for the calibration picker. */
  vendors: VendorOption[];
  /** Where to add an item that isn't in the sub-store yet. */
  storeHref: string;
  multipleStores: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerEquipment,
    {},
  );
  const [itemId, setItemId] = useState("");
  const [uncalibrated, setUncalibrated] = useState(false);

  const selected = items.find((i) => i.id === itemId);

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="inventoryItemId">Equipment issued to this lab</Label>
        <select
          id="inventoryItemId"
          name="inventoryItemId"
          required
          className={SELECT_CLASS}
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="" disabled>
            {items.length ? "Select…" : "Nothing issued to this lab's sub-store yet"}
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id} disabled={i.registered}>
              {i.code ? `[${i.code}] ` : ""}
              {i.name}
              {i.make || i.model ? ` · ${[i.make, i.model].filter(Boolean).join(" ")}` : ""}
              {multipleStores ? ` · ${i.storeName}` : ""}
              {i.registered ? " — already registered" : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Only equipment already issued to the lab&rsquo;s sub-store can be
          registered — it is not in use while it sits in the main store. Not
          listed?{" "}
          <Link href={storeHref} className="underline">
            Issue it to the sub-store
          </Link>{" "}
          first.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="location">Location in lab</Label>
          <Input
            id="location"
            name="location"
            required
            placeholder="e.g. Instrument Room, Bench 2"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="serialNo">Serial number</Label>
          <Input id="serialNo" name="serialNo" />
        </div>
      </div>

      {selected && (
        <p className="-mt-1 text-xs text-muted-foreground">
          Registering <span className="font-medium">{selected.name}</span>
          {selected.make ? ` · ${selected.make}` : ""}
          {selected.model ? ` ${selected.model}` : ""} — name, make and model come
          from the store record.
        </p>
      )}

      <fieldset className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Calibration</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="uncalibrated"
            checked={uncalibrated}
            onChange={(e) => setUncalibrated(e.target.checked)}
            className="size-4"
          />
          Not calibrated yet — calibration is still due
        </label>
        {!uncalibrated && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="calibratedOn">Calibrated on</Label>
                <DateInput id="calibratedOn" name="calibratedOn" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="validUntil">Valid until</Label>
                <DateInput id="validUntil" name="validUntil" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CalibratorSelect vendors={vendors} />
              <div className="grid gap-1.5">
                <Label htmlFor="certificateNo">Certificate number</Label>
                <Input
                  id="certificateNo"
                  name="certificateNo"
                  placeholder="e.g. CAL-2026-0142"
                />
              </div>
            </div>
          </>
        )}
      </fieldset>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending || !itemId}>
          {pending ? "Registering…" : "Register equipment"}
        </Button>
      </div>
    </form>
  );
}
