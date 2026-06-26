"use client";

import { useActionState } from "react";
import { createPR, type FormState } from "@/lib/actions/purchase-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ROWS = [0, 1, 2, 3, 4];

export function PRForm({ categories }: { categories: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPR,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" />
      </div>
      <div className="divide-y rounded-md border">
        <div className="grid grid-cols-[1fr_170px_70px_80px] gap-2 p-2 text-xs text-muted-foreground">
          <span>Description</span>
          <span>Category</span>
          <span>Qty</span>
          <span>Unit</span>
        </div>
        {ROWS.map((i) => (
          <div key={i} className="grid grid-cols-[1fr_170px_70px_80px] gap-2 p-2">
            <Input name="description" placeholder="item" />
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
            <Input name="quantity" type="number" min="1" defaultValue="1" />
            <Input name="unit" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Stationery, sanitary, furniture, PPE and utilities route the simplified
        (PO-only) path; everything else requires quotations.
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
