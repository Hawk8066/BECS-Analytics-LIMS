"use client";

import { Fragment, useState } from "react";
import { submitInspection } from "@/lib/actions/receiving";
import {
  CHECKS_BY_SECTION,
  CHECK_LABEL,
  SECTION_LABEL,
  SECTION_ORDER,
  type CheckField,
  type Section,
} from "@/lib/procurement/inspection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface Item {
  poLineId: string;
  name: string;
  section: Section;
}

// Radio options for a check field.
function optionsFor(field: CheckField): { v: string; l: string }[] {
  if (field === "expiry")
    return [
      { v: "OK", l: "OK" },
      { v: "EXPIRED", l: "Expired" },
      { v: "NA", l: "N/A" },
    ];
  const base = [
    { v: "YES", l: "Yes" },
    { v: "NO", l: "No" },
  ];
  return field === "storage" ? [...base, { v: "NA", l: "N/A" }] : base;
}

export function InspectButton({
  receiptId,
  supplier,
  prNo,
  items,
}: {
  receiptId: string;
  supplier: string;
  prNo: string;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);

  // Only sections with items, in a stable order; flatten so each item has an
  // index for its form-field names, with a header before each section's first.
  const flat = [...items].sort(
    (a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section),
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
            <input type="hidden" name="itemCount" value={flat.length} />

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

            {flat.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                This delivery has no line items to inspect.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {flat.map((it, i) => {
                  const firstOfSection =
                    i === 0 || flat[i - 1].section !== it.section;
                  return (
                    <Fragment key={it.poLineId || i}>
                      {firstOfSection && (
                        <div className="pt-1 text-sm font-semibold">
                          {SECTION_LABEL[it.section]}
                        </div>
                      )}
                      <div className="rounded-md border p-3">
                        <div className="text-sm font-medium">{it.name}</div>
                        <input
                          type="hidden"
                          name={`item_${i}_name`}
                          value={it.name}
                        />
                        <input
                          type="hidden"
                          name={`item_${i}_section`}
                          value={it.section}
                        />
                        <input
                          type="hidden"
                          name={`item_${i}_poLineId`}
                          value={it.poLineId}
                        />
                        <div className="mt-1 divide-y">
                          {CHECKS_BY_SECTION[it.section].map((field) => (
                            <div
                              key={field}
                              className="flex flex-wrap items-center justify-between gap-2 py-1"
                            >
                              <span className="text-sm">
                                {CHECK_LABEL[field]}
                              </span>
                              <div className="flex gap-3 text-sm">
                                {optionsFor(field).map((o) => (
                                  <label
                                    key={o.v}
                                    className="flex items-center gap-1"
                                  >
                                    <input
                                      type="radio"
                                      name={`item_${i}_${field}`}
                                      value={o.v}
                                    />{" "}
                                    {o.l}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}

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
