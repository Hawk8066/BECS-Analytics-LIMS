import type { ItemCategory } from "@prisma/client";

// The Incoming Inspection Checklist (BECS/FF/606/09) groups items into three
// sections, each with its own set of checks. Requested item categories map onto
// these sections so only the relevant sections (and their items) appear.

export type Section = "chemical" | "equipment" | "material";

export function inspectionSection(category: ItemCategory): Section {
  if (category === "CHEMICAL" || category === "CRM") return "chemical";
  // Repair work is inspected as equipment (specs + packing) — asking "quantity
  // as per order" of a repair makes no sense.
  if (
    category === "EQUIPMENT" ||
    category === "EQUIPMENT_SUPPLY" ||
    category === "EQUIPMENT_REPAIR"
  )
    return "equipment";
  return "material";
}

export const SECTION_LABEL: Record<Section, string> = {
  chemical: "Chemicals",
  equipment: "Equipment",
  material: "Material",
};

export const SECTION_ORDER: Section[] = ["chemical", "equipment", "material"];

// The checks that apply to an item, by section. `expiry` is OK/Expired; `storage`
// is a "where applicable" yes/no; the rest are plain yes/no.
export type CheckField = "specs" | "quantity" | "packing" | "expiry" | "storage";

export const CHECK_LABEL: Record<CheckField, string> = {
  specs: "Specifications as per the order",
  quantity: "Quantity as per order",
  packing: "Proper packing",
  expiry: "Expiry date (where applicable)",
  storage: "Storage instructions complied (where applicable)",
};

export const CHECKS_BY_SECTION: Record<Section, CheckField[]> = {
  chemical: ["specs", "quantity", "packing", "expiry", "storage"],
  equipment: ["specs", "packing"],
  material: ["specs", "quantity"],
};

// Between the lowercase UI Section and the Prisma InspectionSection enum value.
export function sectionEnum(s: Section): "CHEMICAL" | "EQUIPMENT" | "MATERIAL" {
  return s.toUpperCase() as "CHEMICAL" | "EQUIPMENT" | "MATERIAL";
}
export function sectionFromEnum(e: string): Section {
  return e.toLowerCase() as Section;
}
