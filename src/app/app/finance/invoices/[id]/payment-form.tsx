"use client";

import { useActionState } from "react";
import { recordPayment, type FormState } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PaymentForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordPayment,
    {},
  );
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 border-t pt-3"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Amount (PKR)</label>
        <Input name="amount" type="number" min="0" step="0.01" required className="w-32" />
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Method</label>
        <Input name="method" placeholder="bank / cash" className="w-32" />
      </div>
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
