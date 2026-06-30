"use client";

import { useActionState } from "react";
import { applyLeave, type FormState } from "@/lib/actions/leave";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";

export function LeaveForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    applyLeave,
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          required
          defaultValue="ANNUAL"
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="ANNUAL">Annual</option>
          <option value="CASUAL">Casual</option>
          <option value="SICK">Sick</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fromDate">From</Label>
          <DateInput id="fromDate" name="fromDate" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="toDate">To</Label>
          <DateInput id="toDate" name="toDate" required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" name="reason" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Apply for leave"}
        </Button>
      </div>
    </form>
  );
}
