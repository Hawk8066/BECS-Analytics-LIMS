"use client";

import { useActionState, useEffect } from "react";
import { recordVendorPayment, type FormState } from "@/lib/actions/vendor-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VendorPaymentForm({
  billId,
  balance,
  onDone,
}: {
  billId: string;
  /** Outstanding balance in paisa, to pre-fill the amount. */
  balance?: number;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordVendorPayment,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="billId" value={billId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="vpay-amount">Amount (PKR)</Label>
          <Input
            id="vpay-amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={balance != null ? balance / 100 : undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vpay-method">Method</Label>
          <Input id="vpay-method" name="method" placeholder="bank / cash / cheque" />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
