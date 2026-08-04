"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { getParameterPriceHistory, setParametersPrice } from "@/lib/actions/parameters";
import { formatDate } from "@/lib/format";
import { priceAt, type PriceEntry } from "@/lib/pricing";
import { PriceTrail } from "./price-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PriceParam {
  id: string;
  name: string;
  unit: string | null;
  matrix: string | null;
  tatDays: number | null;
  tatUrgentDays: number | null;
}

const tat = (days: number | null) => (days === null ? "—" : `${days}d`);

const pkr = (paisa: number | null | undefined) =>
  paisa == null ? "—" : `PKR ${(paisa / 100).toLocaleString("en-PK")}`;

const asRupees = (paisa: number | null | undefined) =>
  paisa == null ? "" : String(paisa / 100);

/** The same test in another matrix — a candidate for a shared price revision. */
interface Sibling {
  id: string;
  matrix: string | null;
  entry: PriceEntry | undefined;
}

/**
 * Popup to revise a parameter's Normal and Urgent prices. Each rate is saved
 * only if it changed; the dated trail below shows the history. Closing with a
 * successful save lets the revalidated page render the new figures.
 *
 * When the same test exists in other matrices (a distinct Parameter per
 * `(name, matrix)`), it can be revised across all of them at once: the copies
 * currently at the same normal price are pre-selected, differently-priced ones
 * are listed so they can be opted in.
 */
function ReviseModal({
  param,
  entry,
  siblings,
  onClose,
}: {
  param: PriceParam;
  entry: PriceEntry | undefined;
  siblings: Sibling[];
  onClose: () => void;
}) {
  const initialNormal = asRupees(entry?.normal);
  // Show the explicit urgent price only; the placeholder hints the auto +50%.
  const initialUrgent = asRupees(entry?.urgent);
  const autoUrgent = entry?.urgent == null ? priceAt(entry, "URGENT") : null;

  const [normal, setNormal] = useState(initialNormal);
  const [urgent, setUrgent] = useState(initialUrgent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Default to the copies already at this row's normal price (the "same price"
  // group). Null == null counts as the same (both unpriced).
  const samePrice = (s: Sibling) => (s.entry?.normal ?? null) === (entry?.normal ?? null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(siblings.filter(samePrice).map((s) => s.id)),
  );
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  // Copies classified into their current price tiers, so a whole tier can be
  // brought in line at once.
  const priceGroups = useMemo(() => {
    const m = new Map<number | null, Sibling[]>();
    for (const s of siblings) {
      const key = s.entry?.normal ?? null;
      const list = m.get(key);
      if (list) list.push(s);
      else m.set(key, [s]);
    }
    for (const list of m.values())
      list.sort((a, b) => (a.matrix ?? "~").localeCompare(b.matrix ?? "~"));
    // Cheapest first; unpriced (null) last.
    return [...m.entries()].sort((a, b) => (a[0] ?? Infinity) - (b[0] ?? Infinity));
  }, [siblings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError("");
    // This row plus every ticked copy in another matrix.
    const parameterIds = [param.id, ...siblings.filter((s) => selected.has(s.id)).map((s) => s.id)];
    // Save each grade the user actually changed, across all targets.
    if (normal.trim() !== initialNormal.trim()) {
      const r = await setParametersPrice({ parameterIds, priority: "NORMAL", price: normal });
      if (!r.ok) {
        setError(r.error);
        setSaving(false);
        return;
      }
    }
    if (urgent.trim() !== initialUrgent.trim()) {
      const r = await setParametersPrice({ parameterIds, priority: "URGENT", price: urgent });
      if (!r.ok) {
        setError(r.error);
        setSaving(false);
        return;
      }
    }
    onClose();
  }

  const allSelected = selected.size === siblings.length && siblings.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Revise price — ${param.name}`}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold">{param.name}</h2>
          <p className="text-xs text-muted-foreground">
            {param.matrix || "— (no matrix)"}
            {param.unit ? ` · ${param.unit}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="revise-normal">Normal (PKR)</Label>
            <Input
              id="revise-normal"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={normal}
              onChange={(e) => setNormal(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="revise-urgent">Urgent (PKR)</Label>
            <Input
              id="revise-urgent"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={urgent}
              onChange={(e) => setUrgent(e.target.value)}
              placeholder={autoUrgent != null ? `${autoUrgent / 100} (auto +50%)` : "—"}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to charge urgent at normal +50%.
            </p>
          </div>
        </div>

        {siblings.length > 0 && (
          <div className="space-y-1.5 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">
                Also apply to “{param.name}” in {siblings.length} other{" "}
                {siblings.length === 1 ? "matrix" : "matrices"}
              </p>
              <button
                type="button"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(siblings.map((s) => s.id)))
                }
                className="whitespace-nowrap text-xs text-primary underline underline-offset-2"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copies at the same price are ticked; tick others to bring them in line.
            </p>

            <div className="max-h-44 space-y-1 overflow-y-auto">
              {priceGroups.map(([price, group]) => {
                const ids = group.map((s) => s.id);
                const all = ids.every((id) => selected.has(id));
                const some = ids.some((id) => selected.has(id));
                return (
                  <div key={String(price)} className="space-y-0.5">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={all}
                        ref={(el) => {
                          if (el) el.indeterminate = some && !all;
                        }}
                        onChange={() => setMany(ids, !all)}
                      />
                      <span className="flex-1">{pkr(price)}</span>
                      <span className="text-xs text-muted-foreground">{group.length}</span>
                    </label>
                    <div className="ml-6 space-y-0.5">
                      {group.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={selected.has(s.id)}
                            onChange={() => toggle(s.id)}
                          />
                          <span className="flex-1 truncate">
                            {s.matrix || "— (no matrix)"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving
              ? "Saving…"
              : selected.size > 0
                ? `Save · ${selected.size + 1} matrices`
                : "Save"}
          </Button>
        </div>

        <div className="border-t pt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Price history</p>
          <PriceTrail load={() => getParameterPriceHistory(param.id)} />
        </div>
      </div>
    </div>
  );
}

export function SectorPrices({
  parameters,
  prices,
  dates,
  canManage,
}: {
  parameters: PriceParam[];
  // prices[parameterId] = { normal, urgent } in paisa
  prices: Record<string, PriceEntry>;
  // dates[parameterId] = ISO date the price was last set
  dates: Record<string, string>;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [revising, setRevising] = useState<PriceParam | null>(null);

  /** The urgent figure to show and whether it's the auto +50% default. */
  const urgentShown = (pid: string) => {
    const entry = prices[pid];
    return { paisa: priceAt(entry, "URGENT"), derived: entry?.urgent == null };
  };

  // Parameters grouped by name, so the Revise popup can offer the same test's
  // copies in other matrices for a shared price revision.
  const byName = useMemo(() => {
    const m = new Map<string, PriceParam[]>();
    for (const p of parameters) {
      const list = m.get(p.name);
      if (list) list.push(p);
      else m.set(p.name, [p]);
    }
    return m;
  }, [parameters]);

  // Filter by matrix, then group the survivors by matrix — typing a matrix name
  // pulls up its whole panel.
  const { groups, shownCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? parameters.filter((p) => p.matrix?.toLowerCase().includes(q))
      : parameters;

    const m = new Map<string, PriceParam[]>();
    for (const p of [...matches].sort(
      (a, b) =>
        (a.matrix ?? "~").localeCompare(b.matrix ?? "~") ||
        a.name.localeCompare(b.name),
    )) {
      const key = p.matrix || "— (no matrix)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return { groups: [...m.entries()], shownCount: matches.length };
  }, [parameters, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search matrix…"
            aria-label="Search by matrix"
            className="h-9 w-64 pr-14"
          />
          {query && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {shownCount}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        One price per parameter, grouped by matrix, at two grades: normal and urgent.
        Urgent defaults to normal +50%. Use <span className="font-medium">Revise</span> to
        change a price; every change is logged with its date.
      </p>

      <div className="overflow-x-auto rounded-md border">
        {/* Compact + wrapping: the shared cell defaults to nowrap + p-2, which
            is too wide for this many columns. Override just this table, and size
            columns to their content (w-auto) so the first column doesn't get
            stretched to fill the wide container. */}
        <Table className="w-auto text-xs [&_td]:whitespace-normal [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_th]:h-8 [&_th]:whitespace-normal [&_th]:px-3">
          <TableHeader>
            <TableRow>
              <TableHead>Parameter</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-center">TAT<br />N/U</TableHead>
              <TableHead className="text-right">Normal</TableHead>
              <TableHead className="text-right">Urgent</TableHead>
              <TableHead>Last set</TableHead>
              {canManage && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([matrix, list]) => (
              <Fragment key={matrix}>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell colSpan={canManage ? 7 : 6} className="font-semibold">
                    {matrix}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({list.length})
                    </span>
                  </TableCell>
                </TableRow>
                {list.map((p) => {
                  const u = urgentShown(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.unit || "—"}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {tat(p.tatDays)} / {tat(p.tatUrgentDays)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pkr(prices[p.id]?.normal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pkr(u.paisa)}
                        {u.derived && u.paisa != null && (
                          <span className="block font-normal text-muted-foreground">
                            auto +50%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dates[p.id] ? formatDate(dates[p.id]) : "—"}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => setRevising(p)}
                          >
                            Revise
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
            {groups.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="text-center text-muted-foreground"
                >
                  {parameters.length === 0
                    ? "No parameters yet."
                    : `No matrix matches “${query.trim()}”.`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {revising && (
        <ReviseModal
          param={revising}
          entry={prices[revising.id]}
          siblings={(byName.get(revising.name) ?? [])
            .filter((x) => x.id !== revising.id)
            .map((x) => ({ id: x.id, matrix: x.matrix, entry: prices[x.id] }))}
          onClose={() => setRevising(null)}
        />
      )}
    </div>
  );
}
