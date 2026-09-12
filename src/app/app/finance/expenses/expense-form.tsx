"use client";

import { useActionState, useEffect, useRef } from "react";
import { recordExpense, type FormState } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function ExpenseForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordExpense,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Expenses get entered in batches, so clear the form for the next one.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="category">What was it for</Label>
          <select
            id="category"
            name="category"
            required
            defaultValue=""
            className={SELECT_CLASS}
          >
            <option value="" disabled>
              Select…
            </option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payee">Paid to</Label>
          <Input id="payee" name="payee" placeholder="LESCO, landlord, …" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount (PKR)</Label>
          <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paidFrom">Paid from</Label>
          <select
            id="paidFrom"
            name="paidFrom"
            defaultValue="BANK"
            className={SELECT_CLASS}
          >
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="spentAt">Date</Label>
          <DateInput id="spentAt" name="spentAt" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="memo">Note</Label>
        <Textarea id="memo" name="memo" rows={2} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Expense recorded.</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record expense"}
        </Button>
      </div>
    </form>
  );
}
