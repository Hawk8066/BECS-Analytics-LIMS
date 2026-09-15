"use client";

import { useActionState, useState } from "react";
import { issueGatePass, type FormState } from "@/lib/actions/equipment-repair";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { VendorOption } from "../../calibrator-select";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

/**
 * Release the asset for off-site repair. On success the action redirects to the
 * printable pass, so the modal never has to close itself.
 */
export function IssueGatePassButton({
  repairId,
  vendors,
  defaultVendorId,
}: {
  repairId: string;
  vendors: VendorOption[];
  defaultVendorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    issueGatePass,
    {},
  );

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Issue gate pass
      </Button>
      {open && (
        <Modal
          title="Issue gate pass"
          onClose={() => setOpen(false)}
          className="max-w-lg"
        >
          <p className="text-sm text-muted-foreground">
            Authorises this asset to leave the premises. Print the pass and send
            it out with the equipment; the return is closed against the same pass.
          </p>
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="repairId" value={repairId} />
            <div className="grid gap-1.5">
              <Label htmlFor="gp-vendor">Going to</Label>
              <select
                id="gp-vendor"
                name="vendorId"
                defaultValue={defaultVendorId}
                className={SELECT_CLASS}
              >
                <option value="">Select…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.company}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="gp-out">Date of despatch</Label>
                <DateInput id="gp-out" name="outDate" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gp-back">Expected back</Label>
                <DateInput id="gp-back" name="expectedReturnDate" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gp-accessories">Accessories going with it</Label>
              <Input
                id="gp-accessories"
                name="accessories"
                placeholder="probes, cables, manuals…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gp-purpose">Purpose</Label>
              <Input
                id="gp-purpose"
                name="purpose"
                placeholder="defaults to the reported fault"
              />
            </div>
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Issuing…" : "Issue & print"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
