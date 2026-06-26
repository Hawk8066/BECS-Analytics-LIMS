"use client";

import { useActionState } from "react";
import { issueInvoice, type FormState } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function InvoiceForm({
  clients,
}: {
  clients: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    issueInvoice,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="clientId">Client</Label>
        <select
          id="clientId"
          name="clientId"
          required
          defaultValue=""
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="amount">Amount (PKR)</Label>
        <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="memo">Memo</Label>
        <Textarea id="memo" name="memo" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Issuing…" : "Issue invoice"}
        </Button>
      </div>
    </form>
  );
}
