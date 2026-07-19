import type { InventoryCategory } from "@prisma/client";

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
