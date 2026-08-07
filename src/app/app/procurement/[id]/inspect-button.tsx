"use client";

import { useState } from "react";
import { submitInspection } from "@/lib/actions/receiving";
import {
  CHEM_CHECKS,
  EQUIP_CHECKS,
  MAT_CHECKS,
  type Check,
} from "@/lib/procurement/inspection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

// A labelled radio group for one check (Yes / No, plus N/A on "where applicable").
function options(applicable?: boolean) {
  return applicable
    ? [
        { v: "YES", l: "Yes" },
        { v: "NO", l: "No" },
        { v: "NA", l: "N/A" },
      ]
    : [
        { v: "YES", l: "Yes" },
        { v: "NO", l: "No" },
      ];
}

export function InspectButton({
  receiptId,
  supplier,
  prNo,
  chemicalItems,
  equipmentItems,
  materialItems,
}: {
  receiptId: string;
  supplier: string;
  prNo: string;
  chemicalItems: string;
  equipmentItems: string;
  materialItems: string;
}) {
  const [open, setOpen] = useState(false);

  const checkRow = (c: Check) => (
    <div
      key={c.key}
      className="flex flex-wrap items-center justify-between gap-2 py-1"
    >
      <span className="text-sm">{c.label}</span>
      <div className="flex gap-3 text-sm">
        {options(c.applicable).map((o) => (
          <label key={o.v} className="flex items-center gap-1">
            <input type="radio" name={c.key} value={o.v} /> {o.l}
          </label>
        ))}
      </div>
    </div>
  );

  const itemsField = (name: string, label: string, value: string) => (
    <div className="grid gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input name={name} defaultValue={value} placeholder="Items in this section" />
    </div>
  );

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Inspect
      </Button>
      {open && (
        <Modal
          title="Incoming Inspection Checklist"
          onClose={() => setOpen(false)}
          className="max-w-2xl"
        >
          <p className="-mt-2 mb-3 font-mono text-xs text-muted-foreground">
            BECS/FF/606/09 · Rev 00 · Issue 01
          </p>
          <form action={submitInspection} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="receiptId" value={receiptId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Name of supplier
                </label>
                <Input name="supplier" defaultValue={supplier} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Purchase requisition no.
                </label>
                <Input defaultValue={prNo} readOnly className="bg-muted/40" />
              </div>
            </div>

            {/* Chemicals */}
            <fieldset className="mt-4 rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">Chemicals</legend>
              {itemsField("chemicalItems", "Chemicals", chemicalItems)}
              <div className="mt-2 divide-y">
                {CHEM_CHECKS.map(checkRow)}
                {/* Expiry is OK / Expired */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <span className="text-sm">
                    Check expiry date (where applicable)
                  </span>
                  <div className="flex gap-3 text-sm">
                    {[
                      { v: "OK", l: "OK" },
                      { v: "EXPIRED", l: "Expired" },
                      { v: "NA", l: "N/A" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-center gap-1">
                        <input type="radio" name="chemExpiry" value={o.v} />{" "}
                        {o.l}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Equipment */}
            <fieldset className="mt-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">Equipment</legend>
              {itemsField("equipmentItems", "Equipment", equipmentItems)}
              <div className="mt-2 divide-y">{EQUIP_CHECKS.map(checkRow)}</div>
            </fieldset>

            {/* Material */}
            <fieldset className="mt-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">Material</legend>
              {itemsField("materialItems", "Material", materialItems)}
              <div className="mt-2 divide-y">{MAT_CHECKS.map(checkRow)}</div>
            </fieldset>

            <div className="mt-3 grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Notes / remarks
              </label>
              <textarea
                name="notes"
                rows={2}
                className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
                placeholder="e.g. vendor supplied 150 mm filter paper, replaced with 125 mm"
              />
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Accepting passes the delivery to the Store In-charge for GRN;
              rejecting sends it back. The checklist is saved either way.
            </p>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                name="decision"
                value="REJECTED"
                variant="outline"
                size="sm"
              >
                Reject
              </Button>
              <Button type="submit" name="decision" value="ACCEPTED" size="sm">
                Accept
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
