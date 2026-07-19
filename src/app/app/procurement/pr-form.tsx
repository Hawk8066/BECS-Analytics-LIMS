"use client";

import { useActionState, useState } from "react";
import { createPR, type FormState } from "@/lib/actions/purchase-requests";
import { PRIORITIES, DEFAULT_PRIORITY } from "@/lib/priorities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Mirrors the "Name of item/services · Specification · Quantity · Justification
// · Remarks" columns of the BECS Purchase Requisition Form (BECS/FF/606/05).
// Category drives the FULL vs SIMPLIFIED procurement path and is not on the
// paper form, but is required to route the request.

let rowSeq = 0;
const newRow = () => ({ key: rowSeq++ });

export function PRForm({ categories }: { categories: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPR,
    {},
  );
  const [rows, setRows] = useState(() => [newRow(), newRow(), newRow()]);

  const addRow = () => setRows((r) => [...r, newRow()]);
  const removeRow = (key: number) =>
    setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

  return (
    <form action={formAction} className="grid gap-5">
      <div className="overflow-x-auto rounded-md border">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[36px_1.4fr_1.1fr_64px_80px_150px_1.1fr_1fr_32px] gap-2 border-b bg-muted/40 p-2 text-xs font-medium text-muted-foreground">
            <span>Sr#</span>
            <span>Name of item / services</span>
            <span>Specification</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Category</span>
            <span>Justification</span>
            <span>Priority</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div
              key={row.key}
              className="grid grid-cols-[36px_1.4fr_1.1fr_64px_80px_150px_1.1fr_1fr_32px] items-center gap-2 border-b p-2 last:border-b-0"
            >
              <span className="text-center text-sm text-muted-foreground">
                {i + 1}
              </span>
              <Input name="description" placeholder="Item / service" />
              <Input name="specification" placeholder="Grade / model / spec" />
              <Input name="quantity" type="number" min="1" defaultValue="1" />
              <Input name="unit" placeholder="e.g. pcs" />
              <select
                name="category"
                defaultValue="CHEMICAL"
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input name="justification" placeholder="Why needed" />
              <select
                name="priority"
                defaultValue={DEFAULT_PRIORITY}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                aria-label="Remove row"
                className="mx-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Add row
        </Button>
      </div>

      <div className="grid max-w-2xl gap-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <p className="text-xs text-muted-foreground">
        Stationery, sanitary, furniture, PPE and utilities route the simplified
        (PO-only) path; everything else requires quotations. Only rows with an
        item name are saved.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit purchase request"}
        </Button>
      </div>
    </form>
  );
}
