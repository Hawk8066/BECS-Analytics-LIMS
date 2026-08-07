import type { Designation, SectionType } from "@prisma/client";

// Sign-in "entrances" shown as buttons on the landing page. Each user maps to
// exactly one, and login is restricted to the matching entrance when chosen.
export type Entrance =
  | "lahore-lab"
  | "ryk-lab"
  | "management"
  | "client"
  | "vendor"
  | "outsource";

export function entranceOf(
  designation: Designation,
  sectionType?: SectionType | null,
): Entrance | null {
  if (designation === "CLIENT") return "client";
  if (designation === "VENDOR") return "vendor";
  if (designation === "OUTSOURCE_LAB") return "outsource";
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

// The landing page each designation is sent to once authenticated. Kept in step
// with the same routing in auth.config.ts (authorized callback) and the app layout.
export function homePathFor(designation: Designation): string {
  if (designation === "CLIENT") return "/portal";
  if (designation === "VENDOR") return "/vendor";
  if (designation === "OUTSOURCE_LAB") return "/outsource";
  return "/app";
}

export const ENTRANCE_LABELS: Record<Entrance, string> = {
  "lahore-lab": "Lahore Lab",
  "ryk-lab": "RYK Lab",
  management: "Management",
  client: "Client",
  vendor: "Vendor",
  outsource: "Outsource Lab",
};
