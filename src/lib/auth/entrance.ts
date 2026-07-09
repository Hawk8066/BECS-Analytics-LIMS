import type { Designation, SectionType } from "@prisma/client";

// Sign-in "entrances" shown as buttons on the landing page. Each user maps to
// exactly one, and login is restricted to the matching entrance when chosen.
export type Entrance =
  | "lahore-lab"
  | "ryk-lab"
  | "management"
  | "client"
  | "vendor";

export function entranceOf(
  designation: Designation,
  sectionType?: SectionType | null,
): Entrance | null {
  if (designation === "CLIENT") return "client";
  if (designation === "VENDOR") return "vendor";
  switch (sectionType) {
    case "LAHORE_LAB":
      return "lahore-lab";
    case "RYK_LAB":
      return "ryk-lab";
    case "MANAGEMENT":
      return "management";
    default:
      return null;
  }
}

export const ENTRANCE_LABELS: Record<Entrance, string> = {
  "lahore-lab": "Lahore Lab",
  "ryk-lab": "RYK Lab",
  management: "Management",
  client: "Client",
  vendor: "Vendor",
};
