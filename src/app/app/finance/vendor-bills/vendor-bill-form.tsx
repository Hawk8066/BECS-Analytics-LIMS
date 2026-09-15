"use client";

import { useActionState, useState } from "react";
import { createVendorBill, type FormState } from "@/lib/actions/vendor-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type VendorOption = {
  id: string;
  company: string;
  pos: { id: string; poNo: string; amount: number | null }[];
};

const SELECT_CLASS =
  "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function VendorBillForm({ vendors }: { vendors: VendorOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createVendorBill,
    {},
  );
  const [vendorId, setVendorId] = useState("");
  // Only this vendor's orders can be billed, so the PO list follows the vendor.
  const pos = vendors.find((v) => v.id === vendorId)?.pos ?? [];

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="vendorId">Vendor</Label>
          <select
            id="vendorId"
            name="vendorId"
            required
            className={SELECT_CLASS}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="" disabled>
              Select…
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="poId">Purchase order (optional)</Label>
          <select id="poId" name="poId" className={SELECT_CLASS} defaultValue="">
            <option value="">— none —</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.poNo}
                {p.amount ? ` · PKR ${(p.amount / 100).toLocaleString("en-PK")}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="subtotal">Amount before tax (PKR)</Label>
          <Input
            id="subtotal"
            name="subtotal"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="taxPct">Sales tax %</Label>
          <select id="taxPct" name="taxPct" className={SELECT_CLASS} defaultValue="0">
            {[0, 5, 15, 16, 18].map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vendorInvoiceNo">Vendor invoice #</Label>
          <Input id="vendorInvoiceNo" name="vendorInvoiceNo" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="memo">What it was for</Label>
        <Textarea id="memo" name="memo" rows={2} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record bill"}
        </Button>
      </div>
    </form>
  );
}
