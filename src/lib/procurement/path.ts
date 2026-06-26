import type { ItemCategory, ProcurementPath } from "@prisma/client";

// BR-9 / BR-18: stationery, sanitary supplies, furniture, PPE and utilities use
// the simplified (PO-only) path; everything else uses the full quotation path.
const SIMPLIFIED: ItemCategory[] = [
  "STATIONERY",
  "SANITARY",
  "FURNITURE",
  "PPE",
  "UTILITY",
];

export function pathForCategory(category: ItemCategory): ProcurementPath {
  return SIMPLIFIED.includes(category) ? "SIMPLIFIED" : "FULL";
}
