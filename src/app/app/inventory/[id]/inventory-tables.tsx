"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  INVENTORY_CATEGORIES,
  effectiveThreshold,
  hasExpiry,
  hasPackaging,
  hasSpecification,
  isEquipment,
  stockLevel,
  stockStatusBadge,
} from "@/lib/inventory";
import { useSelection } from "./reorder-selection";

export type InventoryRow = {
  id: string;
  category: string;
  name: string;
  pack: string | null;
  unit: string | null;
  specification: string | null;
  accessories: string[];
  make: string | null;
  quantity: number | null;
  reorderLevel: number | null;
  expiryDate: Date | string | null;
};

// One card per category (uniform column widths). In selection mode a leading
// checkbox column appears so items can be ticked for a bulk requisition.
// Sub-stores show the main store's balance and can only raise a PR for items
// the main store is out of (mainQty nil).
export function InventoryTables({
  items,
  mainBalances = {},
  isSub = false,
}: {
  items: InventoryRow[];
  mainBalances?: Record<string, number>;
  isSub?: boolean;
}) {
  const { mode, selected, toggle } = useSelection();
  const active = mode !== null;
  const mainQtyOf = (name: string) =>
    mainBalances[name.trim().toLowerCase()] ?? 0;

  const byCategory = new Map<string, InventoryRow[]>();
  for (const it of items) {
    const arr = byCategory.get(it.category) ?? [];
    arr.push(it);
    byCategory.set(it.category, arr);
  }
  const sections = INVENTORY_CATEGORIES.filter((c) => byCategory.has(c.value));

  return (
    <>
      {sections.map((c) => {
        const rows = byCategory.get(c.value)!;
        const showPacking = hasPackaging(c.value);
        const showSpec = hasSpecification(c.value);
        const showAccessories = isEquipment(c.value);
        const showExpiry = hasExpiry(c.value);
        return (
          <Card key={c.value}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {c.label}
                <span className="text-sm font-normal text-muted-foreground">
                  ({rows.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    {active && <TableHead className="w-10" />}
                    <TableHead>Name</TableHead>
                    {showPacking && (
                      <TableHead className="w-28">Packing</TableHead>
                    )}
                    {showSpec && (
                      <TableHead className="w-44">Specification</TableHead>
                    )}
                    {showAccessories && (
                      <TableHead className="w-40">Accessories</TableHead>
                    )}
                    <TableHead className="w-16 text-right">Qty</TableHead>
                    <TableHead className="w-24 text-right">Threshold</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    {isSub && (
                      <TableHead className="w-28 text-right">
                        Main store
                      </TableHead>
                    )}
                    <TableHead className="w-28">Make</TableHead>
                    {showExpiry && (
                      <TableHead className="w-28">Expiry</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => {
                    const pack = [i.pack, i.unit].filter(Boolean).join(" ");
                    const specText = i.specification ?? (pack || "—");
                    const level = stockLevel(i.quantity, i.reorderLevel);
                    const status = stockStatusBadge(level);
                    const isSelected = selected.has(i.id);
                    const mainQty = mainQtyOf(i.name);
                    // On a sub-store a PR is only allowed when the main store is
                    // out of the item; otherwise it should be issued from main.
                    const selectable = !isSub || mainQty === 0;
                    return (
                      <TableRow
                        key={i.id}
                        className={
                          active && isSelected ? "bg-muted/50" : undefined
                        }
                      >
                        {active && (
                          <TableCell>
                            {selectable && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggle(i.id)}
                                aria-label={`Select ${i.name}`}
                                className="size-4 align-middle"
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{i.name}</TableCell>
                        {showPacking && (
                          <TableCell className="text-muted-foreground">
                            {pack || "—"}
                          </TableCell>
                        )}
                        {showSpec && (
                          <TableCell className="text-muted-foreground">
                            {specText}
                          </TableCell>
                        )}
                        {showAccessories && (
                          <TableCell className="text-muted-foreground">
                            {i.accessories.length > 0
                              ? i.accessories.join(", ")
                              : "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">
                          {i.quantity ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {effectiveThreshold(i.reorderLevel)}
                        </TableCell>
                        <TableCell>
                          <Badge className={status.className}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        {isSub && (
                          <TableCell
                            className={`text-right tabular-nums ${
                              mainQty === 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {mainQty}
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground">
                          {i.make ?? "—"}
                        </TableCell>
                        {showExpiry && (
                          <TableCell className="text-muted-foreground">
                            {i.expiryDate ? formatDate(i.expiryDate) : "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
