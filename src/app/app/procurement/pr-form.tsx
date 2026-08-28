"use client";

import { useActionState, useMemo, useState } from "react";
import { createPR, type FormState } from "@/lib/actions/purchase-requests";
import { PRIORITIES, DEFAULT_PRIORITY } from "@/lib/priorities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The BECS Purchase Requisition Form (BECS/FF/606/05). Two tabs: lab items
// (chemicals/glassware/equipment/standards — picked from the inventory catalog)
// and general supplies (stationery/PPE/furniture/…). The Category column both
// filters the item picker and carries the routing ItemCategory (submitted via a
// hidden field; the server derives the FULL vs SIMPLIFIED path from it).

interface Cat {
  key: string;
  label: string;
  category: string; // ItemCategory (routing) submitted for this line
  inv: string | null; // InventoryCategory the item picker filters on (null = free text)
}

const LAB_CATS: Cat[] = [
  { key: "CHEMICAL", label: "Chemical", category: "CHEMICAL", inv: "CHEMICAL" },
  { key: "STANDARD_SOLUTION", label: "Standard Solution", category: "CRM", inv: "STANDARD_SOLUTION" },
  { key: "GLASSWARE", label: "Glassware", category: "GLASSWARE", inv: "GLASSWARE" },
  { key: "EQUIPMENT", label: "Equipment", category: "EQUIPMENT", inv: "EQUIPMENT" },
  { key: "STORE_ITEM", label: "Store Item", category: "LAB_SUPPLY", inv: "STORE_ITEM" },
  { key: "MISCELLANEOUS", label: "Consumable / Misc", category: "LAB_SUPPLY", inv: "MISCELLANEOUS" },
];

const GENERAL_CATS: Cat[] = [
  { key: "STATIONERY", label: "Stationery", category: "STATIONERY", inv: "STATIONERY" },
  { key: "PPE", label: "PPE", category: "PPE", inv: null },
  { key: "SANITARY", label: "Sanitary", category: "SANITARY", inv: null },
  { key: "FURNITURE", label: "Furniture", category: "FURNITURE", inv: null },
  { key: "UTILITY", label: "Utility", category: "UTILITY", inv: null },
];

const COLS =
  "grid-cols-[32px_150px_minmax(140px,1.3fr)_minmax(110px,1fr)_66px_60px_52px_minmax(110px,1fr)_96px_30px]";

// Split a catalog pack string like "500 mL" into its size ("500") and measure
// unit ("mL"), so both auto-fill their own fields.
function splitPack(pack: string): { size: string; unit: string } {
  const m = pack.trim().match(/^([\d.,]+)\s*(.*)$/);
  return m ? { size: m[1], unit: m[2].trim() } : { size: pack.trim(), unit: "" };
}

interface Row {
  key: number;
  catKey: string;
  description: string;
  specification: string;
  packSize: string;
  unit: string;
  quantity: string;
}

// A pre-filled requisition line (e.g. from the reorder board). `catKey` is a
// LAB_CATS / GENERAL_CATS key (equal to the InventoryCategory for lab items).
export interface InitialRow {
  catKey: string;
  description: string;
  specification?: string;
  packSize?: string;
  unit?: string;
  quantity?: string;
}

let rowSeq = 0;
const makeRow = (cats: Cat[]): Row => ({
  key: rowSeq++,
  catKey: cats[0].key,
  description: "",
  specification: "",
  packSize: "",
  unit: "",
  quantity: "1",
});

export function PRForm({
  items,
  initialRows,
}: {
  /** Inventory catalog to pick from: name, classification, pack size + spec hint. */
  items: { name: string; category: string; pack: string; spec: string }[];
  /** Pre-filled lines (e.g. reorder board) — seeds the matching tab. */
  initialRows?: InitialRow[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPR,
    {},
  );

  // Seed a tab's rows from initialRows whose catKey belongs to that tab; empty
  // tabs get one blank row. With no initialRows, the usual blank defaults.
  const seed = (cats: Cat[], fallback: number): Row[] => {
    if (initialRows?.length) {
      const keys = new Set(cats.map((c) => c.key));
      const rows = initialRows
        .filter((r) => keys.has(r.catKey))
        .map((r) => ({
          key: rowSeq++,
          catKey: r.catKey,
          description: r.description,
          specification: r.specification ?? "",
          packSize: r.packSize ?? "",
          unit: r.unit ?? "",
          quantity: r.quantity ?? "1",
        }));
      return rows.length ? rows : [makeRow(cats)];
    }
    return Array.from({ length: fallback }, () => makeRow(cats));
  };

  const seededGeneral = !!initialRows?.some((r) =>
    GENERAL_CATS.some((c) => c.key === r.catKey),
  );
  const seededLab =
    !initialRows?.length ||
    initialRows.some((r) => LAB_CATS.some((c) => c.key === r.catKey));

  const [tab, setTab] = useState<"lab" | "general">(
    seededLab ? "lab" : seededGeneral ? "general" : "lab",
  );
  const [labRows, setLabRows] = useState<Row[]>(() => seed(LAB_CATS, 3));
  const [generalRows, setGeneralRows] = useState<Row[]>(() =>
    seed(GENERAL_CATS, 1),
  );

  // Catalog item names grouped by classification (for the datalists), and a
  // "classification:name" → spec lookup for auto-filling the specification.
  const itemsByInv = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of items) {
      if (!m.has(it.category)) m.set(it.category, []);
      m.get(it.category)!.push(it.name);
    }
    for (const [k, v] of m) m.set(k, [...new Set(v)].sort());
    return m;
  }, [items]);
  const specByItem = useMemo(
    () => new Map(items.map((it) => [`${it.category}:${it.name}`, it.spec])),
    [items],
  );
  const packByItem = useMemo(
    () => new Map(items.map((it) => [`${it.category}:${it.name}`, it.pack])),
    [items],
  );
  const invCats = useMemo(
    () =>
      [...new Set([...LAB_CATS, ...GENERAL_CATS].map((c) => c.inv))].filter(
        (x): x is string => !!x,
      ),
    [],
  );

  function table(rows: Row[], setRows: React.Dispatch<React.SetStateAction<Row[]>>, cats: Cat[]) {
    const catByKey = new Map(cats.map((c) => [c.key, c]));
    const addRow = () => setRows((r) => [...r, makeRow(cats)]);
    const removeRow = (key: number) =>
      setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));
    const patch = (key: number, p: Partial<Row>) =>
      setRows((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-md border">
          <div className="min-w-[1000px]">
            <div
              className={`grid ${COLS} gap-2 border-b bg-muted/40 p-2 text-xs font-medium text-muted-foreground`}
            >
              <span>Sr#</span>
              <span>Category</span>
              <span>Item / service</span>
              <span>Specification</span>
              <span>Pack size</span>
              <span>Unit</span>
              <span>Qty</span>
              <span>Justification</span>
              <span>Priority</span>
              <span />
            </div>
            {rows.map((row, i) => {
              const cat = catByKey.get(row.catKey) ?? cats[0];
              return (
                <div
                  key={row.key}
                  className={`grid ${COLS} items-center gap-2 border-b p-2 last:border-b-0`}
                >
                  <span className="text-center text-sm text-muted-foreground">{i + 1}</span>
                  <select
                    value={row.catKey}
                    onChange={(e) => patch(row.key, { catKey: e.target.value })}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    {cats.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {/* Routing ItemCategory for the server (derived from Category). */}
                  <input type="hidden" name="category" value={cat.category} />
                  <Input
                    name="description"
                    list={cat.inv ? `inv-${cat.inv}` : undefined}
                    value={row.description}
                    onChange={(e) => {
                      const name = e.target.value;
                      const inv = cat.inv;
                      const spec = inv ? specByItem.get(`${inv}:${name}`) : undefined;
                      const packRaw = inv ? packByItem.get(`${inv}:${name}`) : undefined;
                      const p: Partial<Row> = { description: name };
                      if (spec) p.specification = spec;
                      if (packRaw) {
                        const parsed = splitPack(packRaw);
                        p.packSize = parsed.size;
                        if (parsed.unit) p.unit = parsed.unit;
                      }
                      patch(row.key, p);
                    }}
                    placeholder={cat.inv ? "Pick or type item" : "Item / service"}
                  />
                  <Input
                    name="specification"
                    value={row.specification}
                    onChange={(e) => patch(row.key, { specification: e.target.value })}
                    placeholder="Grade / model / spec"
                  />
                  <Input
                    name="packSize"
                    value={row.packSize}
                    onChange={(e) => patch(row.key, { packSize: e.target.value })}
                    placeholder="e.g. 500"
                  />
                  <Input
                    name="unit"
                    value={row.unit}
                    onChange={(e) => patch(row.key, { unit: e.target.value })}
                    placeholder="e.g. mL"
                  />
                  <Input
                    name="quantity"
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => patch(row.key, { quantity: e.target.value })}
                  />
                  <Input name="justification" placeholder="Why needed" />
                  <select
                    name="priority"
                    defaultValue={DEFAULT_PRIORITY}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label="Remove row"
                    className="mx-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Add row
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      {/* One datalist per catalog classification — the item input points at it. */}
      {invCats.map((inv) => (
        <datalist key={inv} id={`inv-${inv}`}>
          {(itemsByInv.get(inv) ?? []).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      ))}

      <div className="flex gap-4 border-b text-sm">
        {(["lab", "general"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-1 py-2 ${
              tab === t
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "lab" ? "Lab Items" : "General Supplies"}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted so either tab's rows submit with the form. */}
      <div className={tab === "lab" ? "" : "hidden"}>{table(labRows, setLabRows, LAB_CATS)}</div>
      <div className={tab === "general" ? "" : "hidden"}>
        {table(generalRows, setGeneralRows, GENERAL_CATS)}
      </div>

      <div className="grid max-w-2xl gap-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <p className="text-xs text-muted-foreground">
        Lab items are picked from the catalog (pack size, unit and specification
        auto-fill — e.g. a 500&nbsp;mL bottle, quantity 1); general supplies are
        typed. Category routes the request — stationery, sanitary,
        furniture, PPE and utility are PO-only; everything else needs quotations.
        Only rows with an item are saved.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit purchase request"}
        </Button>
      </div>
    </form>
  );
}
