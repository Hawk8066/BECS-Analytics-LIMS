"use client";

import { useActionState, useState } from "react";
import { requestRepair, type FormState } from "@/lib/actions/equipment-repair";
import { PRIORITIES } from "@/lib/priorities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VendorOption } from "../calibrator-select";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function RepairForm({
  equipmentId,
  vendors,
}: {
  equipmentId: string;
  vendors: VendorOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestRepair,
    {},
  );
  const [kind, setKind] = useState("BREAKDOWN");
  const [site, setSite] = useState("OFF_SITE");

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="equipmentId" value={equipmentId} />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="kind">Reason</Label>
          <select
            id="kind"
            name="kind"
            className={SELECT_CLASS}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="BREAKDOWN">Breakdown — the asset has failed</option>
            <option value="MAINTENANCE">Maintenance — planned service</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="site">Where</Label>
          <select
            id="site"
            name="site"
            className={SELECT_CLASS}
            value={site}
            onChange={(e) => setSite(e.target.value)}
          >
            <option value="ON_SITE">On-site — the vendor comes here</option>
            <option value="OFF_SITE">Off-site — it goes to the vendor</option>
          </select>
        </div>
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">
        {site === "OFF_SITE"
          ? "A gate pass must be issued before the asset leaves the premises."
          : "The asset stays here; no gate pass is needed."}{" "}
        {kind === "BREAKDOWN"
          ? "A breakdown takes it out of service immediately."
          : "Planned maintenance leaves it usable until it goes."}
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor="reason">
          {kind === "BREAKDOWN" ? "Fault reported" : "Maintenance required"}
        </Label>
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          required
          placeholder={
            kind === "BREAKDOWN"
              ? "e.g. display flickers and readings drift after 10 minutes"
              : "e.g. annual service — clean optics, replace lamp"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="vendorId">Vendor</Label>
          <select
            id="vendorId"
            name="vendorId"
            defaultValue=""
            className={SELECT_CLASS}
          >
            <option value="">Decide at comparative award</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            className={SELECT_CLASS}
            defaultValue={kind === "BREAKDOWN" ? "High" : "Normal"}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="optional" />
      </div>

      <p className="text-xs text-muted-foreground">
        Raising this opens a repair case and generates a purchase request for the
        work, which follows the usual verification, COO approval and quotation
        route.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Raising…" : "Raise repair request"}
        </Button>
      </div>
    </form>
  );
}
