"use client";

import { useActionState, useState } from "react";
import { bookLot, type FormState } from "@/lib/actions/production-qc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

export interface ParentLotOpt {
  id: string;
  lotNo: string;
  refNo: string;
  verdict: string | null;
}

export interface AnalystOpt {
  id: string;
  name: string;
}

export function BookLotForm({
  productTypeId,
  basis,
  isRaw,
  parentTypeName,
  parentLots,
  analysts,
}: {
  productTypeId: string;
  basis: "VEHICLE" | "BATCH";
  isRaw: boolean;
  parentTypeName: string | null;
  parentLots: ParentLotOpt[];
  analysts: AnalystOpt[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bookLot,
    {},
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const refLabel = basis === "VEHICLE" ? "Vehicle number" : "Batch number";
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="productTypeId" value={productTypeId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`refNo-${productTypeId}`}>{refLabel}</Label>
          <Input
            id={`refNo-${productTypeId}`}
            name="refNo"
            required
            placeholder={basis === "VEHICLE" ? "e.g. LES-4471" : "e.g. AOM-2026-014"}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`producedOn-${productTypeId}`}>
            {isRaw ? "Received date" : "Production date"}
          </Label>
          <DateInput id={`producedOn-${productTypeId}`} name="producedOn" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`quantity-${productTypeId}`}>Quantity</Label>
          <Input
            id={`quantity-${productTypeId}`}
            name="quantity"
            type="number"
            step="0.01"
            min="0"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`quantityUnit-${productTypeId}`}>Unit</Label>
          <Input
            id={`quantityUnit-${productTypeId}`}
            name="quantityUnit"
            placeholder="MT / kg / bags"
          />
        </div>
        {isRaw && (
          <div className="grid gap-1.5">
            <Label htmlFor={`source-${productTypeId}`}>Supplier / source</Label>
            <Input id={`source-${productTypeId}`} name="source" />
          </div>
        )}
      </div>

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor={`assignedToId-${productTypeId}`}>Assign to analyst</Label>
        <select
          id={`assignedToId-${productTypeId}`}
          name="assignedToId"
          defaultValue=""
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Unassigned</option>
          {analysts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {parentTypeName && (
        <div className="grid gap-1.5">
          <Label>
            Traceable to {parentTypeName}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (select source lot{parentLots.length === 1 ? "" : "s"})
            </span>
          </Label>
          {parentLots.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No approved {parentTypeName} lots yet to trace to.
            </p>
          ) : (
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
              {parentLots.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    name="parentLotId"
                    value={p.id}
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="font-mono text-xs">{p.refNo}</span>
                  <span className="text-muted-foreground">({p.lotNo})</span>
                  {p.verdict && (
                    <span
                      className={`ml-auto text-xs ${
                        p.verdict === "PASS" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {p.verdict}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor={`note-${productTypeId}`}>Note (optional)</Label>
        <Input id={`note-${productTypeId}`} name="note" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Booking…" : "Book lot"}
        </Button>
      </div>
    </form>
  );
}
