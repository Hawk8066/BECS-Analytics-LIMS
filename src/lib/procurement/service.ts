import type { ItemCategory } from "@prisma/client";

/**
 * Service categories buy work, not goods. They travel the procurement path like
 * anything else — quotation, comparative, PO, receiving — but they are never
 * credited to a store register: a repair has no quantity to stock, and doing so
 * would leave a permanent phantom item named after the job.
 */
export const SERVICE_CATEGORIES: ItemCategory[] = ["EQUIPMENT_REPAIR"];

export function isServiceCategory(category: ItemCategory): boolean {
  return SERVICE_CATEGORIES.includes(category);
}
