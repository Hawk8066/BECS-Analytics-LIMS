import type { ItemCategory } from "@prisma/client";

// The Incoming Inspection Checklist (BECS/FF/606/09) groups items into three
// sections, each with its own set of checks. Requested item categories map onto
// these sections so the checklist can be pre-filled from the delivery.

export type Section = "chemical" | "equipment" | "material";

export function inspectionSection(category: ItemCategory): Section {
  if (category === "CHEMICAL" || category === "CRM") return "chemical";
  if (category === "EQUIPMENT" || category === "EQUIPMENT_SUPPLY")
    return "equipment";
  return "material";
}

// Yes/No checks per section (field keys align with IncomingInspection columns
// and the form-data names posted from the checklist). Expiry is handled apart
// (OK / Expired). "applicable" marks the "where applicable" rows.
export interface Check {
  key: string;
  label: string;
  applicable?: boolean; // renders an extra N/A option
}

export const CHEM_CHECKS: Check[] = [
  { key: "chemSpecs", label: "Check specifications as per the order" },
  { key: "chemQuantity", label: "Check quantity as per order" },
  { key: "chemPacking", label: "Check proper packing" },
  {
    key: "chemStorage",
    label: "Manufacturer's storage instructions complied",
    applicable: true,
  },
];

export const EQUIP_CHECKS: Check[] = [
  { key: "equipSpecs", label: "Check specifications as per the order" },
  { key: "equipPacking", label: "Check proper packing" },
];

export const MAT_CHECKS: Check[] = [
  { key: "matSpecs", label: "Check specifications as per the order" },
  { key: "matQuantity", label: "Check quantity as per order" },
];

export const SECTION_LABEL: Record<Section, string> = {
  chemical: "Chemicals",
  equipment: "Equipment",
  material: "Material",
};
