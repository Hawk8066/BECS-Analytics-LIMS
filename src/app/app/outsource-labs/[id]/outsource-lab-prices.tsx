"use client";

import { useMemo, useState } from "react";
import { setOutsourceLabPrice } from "@/lib/actions/outsource-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PriceRow {
  id: string;
  name: string;
  matrix: string | null;
  unit: string | null;
  price: number | null; // paisa, the lab's charge for this test
}

const pkr = (paisa: number) => `PKR ${(paisa / 100).toLocaleString("en-PK")}`;

// The lab's per-test price list. Each row saves independently via a plain form
// action (revalidates the page). Grouped by matrix with a search box.
export function OutsourceLabPrices({
  outsourceLabId,
  parameters,
  canManage,
}: {
  outsourceLabId: string;
  parameters: PriceRow[];
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? parameters.filter(
          (p) => p.name.toLowerCase().includes(q) || p.matrix?.toLowerCase().includes(q),
        )
      : parameters;
    const m = new Map<string, PriceRow[]>();
    for (const p of [...matches].sort(
      (a, b) =>
        (a.matrix ?? "~").localeCompare(b.matrix ?? "~") || a.name.localeCompare(b.name),
    )) {
      const key = p.matrix || "— (no matrix)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return [...m.entries()];
  }, [parameters, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tests outsourced to this lab — set what it charges (PKR).
        </p>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search test / matrix…"
          className="h-8 w-56"
        />
      </div>
      <div className="max-h-[26rem] space-y-3 overflow-y-auto rounded-md border p-3">
        {groups.map(([matrix, list]) => (
          <div key={matrix}>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              {matrix} ({list.length})
            </p>
            <div className="space-y-1">
              {list.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {p.name}
                    {p.unit && <span className="text-muted-foreground"> ({p.unit})</span>}
                  </span>
                  {canManage ? (
                    <form
                      action={setOutsourceLabPrice}
                      className="flex items-center gap-1.5"
                    >
                      <input type="hidden" name="outsourceLabId" value={outsourceLabId} />
                      <input type="hidden" name="parameterId" value={p.id} />
                      <Input
                        key={p.price ?? "unset"}
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={p.price != null ? p.price / 100 : ""}
                        placeholder="—"
                        className="h-8 w-28"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Save
                      </Button>
                    </form>
                  ) : (
                    <span className="w-28 text-right text-muted-foreground">
                      {p.price != null ? pkr(p.price) : "—"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {parameters.length === 0
              ? "No tests have been outsourced to this lab yet."
              : `No parameters match “${query.trim()}”.`}
          </p>
        )}
      </div>
    </div>
  );
}
