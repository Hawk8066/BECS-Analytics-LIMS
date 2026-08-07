"use client";

import { useState } from "react";
import { addQuotation } from "@/lib/actions/procurement";
import { packQtyLabel } from "@/lib/procurement/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface Line {
  id: string;
  description: string;
  specification: string | null; // the spec the PR requested
  packSize: string | null;
  quantity: number;
  unit: string | null;
}

/**
 * "Add / revise quotation" popup. A vendor is picked, then a unit rate (and an
 * optional offered specification) is entered per PR line — the cells of the
 * Comparative Statement. Re-submitting for the same vendor replaces its previous
 * quotation. On submit the action revalidates the page; the modal closes.
 */
export function AddQuotationButton({
  prId,
  vendors,
  lines,
}: {
  prId: string;
  vendors: { id: string; company: string }[];
  lines: Line[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Add / revise quotation
      </Button>
      {open && (
        <Modal
          title="Record vendor quotation"
          onClose={() => setOpen(false)}
          className="max-w-3xl"
        >
          <form
            action={addQuotation}
            onSubmit={() => setOpen(false)}
            className="space-y-4"
          >
            <input type="hidden" name="prId" value={prId} />
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Vendor</label>
              <select
                name="vendorId"
                required
                defaultValue=""
                className="h-9 w-full max-w-xs rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="" disabled>
                  Select vendor…
                </option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Sr#</th>
                    <th className="px-2 py-2 text-left font-medium">Item</th>
                    <th className="px-2 py-2 text-left font-medium">Qty</th>
                    <th className="px-2 py-2 text-left font-medium">
                      Offered specification
                    </th>
                    <th className="px-2 py-2 text-left font-medium">
                      Unit rate (PKR)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        <div>{l.description}</div>
                        <div className="text-xs text-muted-foreground">
                          Requested: {l.specification || "—"}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {packQtyLabel(l.quantity, l.packSize, l.unit)}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          name={`spec_${l.id}`}
                          defaultValue={l.specification ?? ""}
                          placeholder="Grade / brand"
                          className="h-8"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          name={`rate_${l.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="h-8 w-28"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Offered specification is pre-filled with what the PR requested —
              change it only where this vendor offers something different. Leave a
              rate blank for items this vendor did not quote; the total is the sum
              of rate × quantity.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save quotation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
