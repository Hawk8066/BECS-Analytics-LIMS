import type { InventoryCategory, ItemCategory } from "@prisma/client";

// Selectable inventory categories with human labels (add-item form + display).
export const INVENTORY_CATEGORIES: { value: InventoryCategory; label: string }[] =
  [
    { value: "CHEMICAL", label: "Chemical" },
    { value: "STANDARD_SOLUTION", label: "Standard Solution" },
    { value: "GLASSWARE", label: "Glassware" },
    { value: "EQUIPMENT", label: "Equipment" },
    { value: "STORE_ITEM", label: "Store Item" },
    { value: "MISCELLANEOUS", label: "Miscellaneous" },
    { value: "STATIONERY", label: "Stationery" },
  ];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  INVENTORY_CATEGORIES.map((c) => [c.value, c.label]),
);

// Only consumables/chemicals carry an expiry date — glassware, equipment and
// stationery are durable, so the expiry field doesn't apply to them.
export const CATEGORIES_WITH_EXPIRY: InventoryCategory[] = [
  "CHEMICAL",
  "STANDARD_SOLUTION",
  "STORE_ITEM",
  "MISCELLANEOUS",
];
export function hasExpiry(category: string): boolean {
  return (CATEGORIES_WITH_EXPIRY as string[]).includes(category);
}

// Equipment is described by a specification + accessories, not a packing size.
export function isEquipment(category: string): boolean {
  return category === "EQUIPMENT";
}
// Glassware and equipment are described by a specification (e.g. a 100 mL
// beaker, or an instrument model) instead of a consumable packing size.
export function hasSpecification(category: string): boolean {
  return category === "EQUIPMENT" || category === "GLASSWARE";
}
// Consumables (chemicals, standards, store items, stationery…) carry a packing
// size + unit; glassware and equipment use a specification instead.
export function hasPackaging(category: string): boolean {
  return (
    category !== "" && category !== "EQUIPMENT" && category !== "GLASSWARE"
  );
}

// Fallback reorder point when an item has no explicit level set: at or below
// this on-hand balance, the item is flagged for reordering.
export const DEFAULT_REORDER_LEVEL = 2;

export type StockLevel = "OK" | "REORDER" | "OUT";

// Automatic stock level from the live balance vs the (per-item or default)
// reorder point. Replaces the old manually-toggled StockStatus.
export function stockLevel(
  quantity: number | null | undefined,
  reorderLevel: number | null | undefined,
): StockLevel {
  const q = quantity ?? 0;
  if (q <= 0) return "OUT";
  const min = reorderLevel ?? DEFAULT_REORDER_LEVEL;
  return q <= min ? "REORDER" : "OK";
}

// The effective threshold that drives the status: the item's own reorder level,
// or the global default when none is set.
export function effectiveThreshold(
  reorderLevel: number | null | undefined,
): number {
  return reorderLevel ?? DEFAULT_REORDER_LEVEL;
}

// Display label + badge colours for a stock level. The className overrides the
// Badge base colours (twMerge → later classes win).
export function stockStatusBadge(level: StockLevel): {
  label: string;
  className: string;
} {
  switch (level) {
    case "OUT":
      return {
        label: "Out of stock",
        className: "bg-destructive/10 text-destructive",
      };
    case "REORDER":
      return {
        label: "Reorder",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
      };
    default:
      return {
        label: "In stock",
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
      };
  }
}

// Reverse of inventoryCategoryFor: the procurement ItemCategory to raise a
// purchase requisition under for a given inventory register category. Mirrors
// the LAB_CATS / GENERAL_CATS tables in pr-form.tsx.
export function itemCategoryFor(category: InventoryCategory): ItemCategory {
  switch (category) {
    case "CHEMICAL":
      return "CHEMICAL";
    case "STANDARD_SOLUTION":
      return "CRM";
    case "GLASSWARE":
      return "GLASSWARE";
    case "EQUIPMENT":
      return "EQUIPMENT";
    case "STATIONERY":
      return "STATIONERY";
    default:
      // STORE_ITEM, MISCELLANEOUS
      return "LAB_SUPPLY";
  }
}

// Lab-only registers: management staff may view them but not report stock on
// them — those belong to the lab teams.
export const LAB_ONLY_CATEGORIES: InventoryCategory[] = [
  "CHEMICAL",
  "GLASSWARE",
  "STANDARD_SOLUTION",
  "EQUIPMENT",
];

export function isLabOnly(category: string): boolean {
  return (LAB_ONLY_CATEGORIES as string[]).includes(category);
}

// Which inventory register a purchased/requisitioned item belongs to. Maps the
// procurement ItemCategory onto the inventory register category so a received
// GRN lands under its designated register (Chemicals, Glassware, …).
export function inventoryCategoryFor(category: ItemCategory): InventoryCategory {
  switch (category) {
    case "CHEMICAL":
      return "CHEMICAL";
    case "CRM":
      return "STANDARD_SOLUTION";
    case "GLASSWARE":
      return "GLASSWARE";
    case "EQUIPMENT":
    case "EQUIPMENT_SUPPLY":
    // Defensive: repair lines are filtered out before any GRN crediting
    // (isServiceCategory), so this case should never be reached — but if one
    // ever is, it belongs with equipment, not in miscellaneous.
    case "EQUIPMENT_REPAIR":
      return "EQUIPMENT";
    case "STATIONERY":
      return "STATIONERY";
    default:
      // LAB_SUPPLY, SANITARY, FURNITURE, PPE, UTILITY
      return "MISCELLANEOUS";
  }
}
