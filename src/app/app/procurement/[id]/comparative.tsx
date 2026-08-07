"use client";

import { Fragment } from "react";
import { selectComparative } from "@/lib/actions/procurement";
import { specDiffers } from "@/lib/procurement/spec";
import { packQtyLabel } from "@/lib/procurement/format";
import { Button } from "@/components/ui/button";

interface Cell {
  id: string; // QuotationLine id
  specification: string | null;
  rate: number; // paisa, per unit
  selected: boolean;
}

interface Line {
  id: string;
  description: string;
  specification: string | null;
  packSize: string | null;
  quantity: number;
  unit: string | null;
  selectionNote: string | null;
}

interface Quote {
  id: string;
  vendor: string;
  total: number; // paisa
  cells: Record<string, Cell | undefined>;
}

function pkr(paisa: number): string {
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

/**
 * Comparative Statement (Form 6-B): PR lines down, vendors across (each showing
 * the offered specification + unit rate). When the COO can award, each line gets
 * a winning-vendor selector + justification; a PR may split across vendors.
 */
export function Comparative({
  prId,
  canAward,
  lines,
  quotations,
}: {
  prId: string;
  canAward: boolean;
  lines: Line[];
  quotations: Quote[];
}) {
  const winnerOf = (lineId: string): string => {
    for (const q of quotations) {
      const c = q.cells[lineId];
      if (c?.selected) return c.id;
    }
    return "";
  };
  // The winning vendor's name for a line (read-only display).
  const wonBy = (lineId: string): string | null => {
    for (const q of quotations) if (q.cells[lineId]?.selected) return q.vendor;
    return null;
  };
  // Any vendor offering a spec different from what the PR requested?
  const anyDiff = lines.some((l) =>
    quotations.some((q) => specDiffers(q.cells[l.id]?.specification, l.specification)),
  );

  const grid = (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-xs">
          <tr>
            <th
              rowSpan={2}
              className="border px-2 py-1.5 text-left font-medium align-bottom"
            >
              Sr#
            </th>
            <th
              rowSpan={2}
              className="border px-2 py-1.5 text-left font-medium align-bottom"
            >
              Description of store
            </th>
            {quotations.map((q) => (
              <th
                key={q.id}
                colSpan={2}
                className="border px-2 py-1.5 text-center font-medium"
              >
                {q.vendor}
              </th>
            ))}
            <th
              rowSpan={2}
              className="border px-2 py-1.5 text-left font-medium align-bottom"
            >
              Selected vendor / Justification
            </th>
          </tr>
          <tr>
            {quotations.map((q) => (
              <Fragment key={q.id}>
                <th className="border px-2 py-1 text-left font-normal text-muted-foreground">
                  Specification
                </th>
                <th className="border px-2 py-1 text-right font-normal text-muted-foreground">
                  Rate
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const won = wonBy(l.id);
            return (
              <tr key={l.id} className="align-top">
                <td className="border px-2 py-1.5 text-muted-foreground">
                  {i + 1}
                </td>
                <td className="border px-2 py-1.5">
                  <div className="font-medium">{l.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {packQtyLabel(l.quantity, l.packSize, l.unit)}
                    {l.specification ? ` · ${l.specification}` : ""}
                  </div>
                </td>
                {quotations.map((q) => {
                  const c = q.cells[l.id];
                  return (
                    <Fragment key={q.id}>
                      <td
                        className={`border px-2 py-1.5 ${
                          c?.selected ? "bg-emerald-50" : ""
                        }`}
                      >
                        {c?.specification || (c ? "—" : "")}
                        {c && specDiffers(c.specification, l.specification) && (
                          <span className="ml-1 whitespace-nowrap rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">
                            differs
                          </span>
                        )}
                      </td>
                      <td
                        className={`border px-2 py-1.5 text-right tabular-nums ${
                          c?.selected ? "bg-emerald-50 font-medium" : ""
                        }`}
                      >
                        {c ? pkr(c.rate) : ""}
                      </td>
                    </Fragment>
                  );
                })}
                <td className="border px-2 py-1.5">
                  {canAward ? (
                    <div className="space-y-1.5">
                      <select
                        name={`winner_${l.id}`}
                        defaultValue={winnerOf(l.id)}
                        className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                      >
                        <option value="">— none —</option>
                        {quotations
                          .filter((q) => q.cells[l.id])
                          .map((q) => (
                            <option key={q.id} value={q.cells[l.id]!.id}>
                              {q.vendor} · {pkr(q.cells[l.id]!.rate)}
                            </option>
                          ))}
                      </select>
                      <input
                        name={`note_${l.id}`}
                        defaultValue={l.selectionNote ?? ""}
                        placeholder="Justification"
                        className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                      />
                    </div>
                  ) : won ? (
                    <div>
                      <div className="font-medium text-emerald-700">{won}</div>
                      {l.selectionNote && (
                        <div className="text-xs text-muted-foreground">
                          {l.selectionNote}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {/* Vendor totals */}
          <tr className="bg-muted/30 font-medium">
            <td className="border px-2 py-1.5" />
            <td className="border px-2 py-1.5 text-right">Total</td>
            {quotations.map((q) => (
              <td
                key={`${q.id}-total`}
                colSpan={2}
                className="border px-2 py-1.5 text-right tabular-nums"
              >
                {pkr(q.total)}
              </td>
            ))}
            <td className="border px-2 py-1.5" />
          </tr>
        </tbody>
      </table>
      </div>
      {anyDiff && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">
            differs
          </span>
          = this vendor&apos;s offered specification isn&apos;t what the PR
          requested. Note why in the justification when awarding it.
        </p>
      )}
    </div>
  );

  if (!canAward) return grid;

  return (
    <form action={selectComparative} className="space-y-3">
      <input type="hidden" name="prId" value={prId} />
      {grid}
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save award
        </Button>
      </div>
    </form>
  );
}
