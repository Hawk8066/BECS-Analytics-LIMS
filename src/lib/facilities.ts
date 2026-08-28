import type { FacilityCode } from "@prisma/client";
import type { SectionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

/**
 * The two labs, as URL segments. Registers that are kept per-lab (equipment,
 * materials, repairs) live at /app/<module>/<slug> so each lab has its own page
 * rather than a mixed list; `section` is the lab section a record created there
 * belongs to, since each facility has exactly one lab section. `tone` is the
 * lab's colour in the sidebar, where each lab is its own section.
 */
export const FACILITIES = [
  {
    slug: "lahore",
    code: "LAHORE" as FacilityCode,
    name: "Lahore",
    short: "Lahore",
    section: "LAHORE_LAB" as SectionType,
    tone: "#2f6f9f",
  },
  {
    slug: "ryk",
    code: "RYK" as FacilityCode,
    name: "Rahim Yar Khan",
    short: "RYK",
    section: "RYK_LAB" as SectionType,
    tone: "#6b4f9c",
  },
] as const;

export type FacilityRoute = (typeof FACILITIES)[number];
export type FacilitySlug = FacilityRoute["slug"];

export function facilityBySlug(slug: string): FacilityRoute | undefined {
  return FACILITIES.find((f) => f.slug === slug);
}

export function facilityByCode(code: FacilityCode): FacilityRoute | undefined {
  return FACILITIES.find((f) => f.code === code);
}

/**
 * The labs a user may open pages for: everyone sees their own; cross-section
 * readers (COO/OM/admin) see both.
 */
export async function readableFacilities(
  user: SessionUser,
): Promise<FacilityRoute[]> {
  if (user.canReadCrossSection) return [...FACILITIES];
  const own = await prisma.facility.findUnique({
    where: { id: user.facilityId },
    select: { code: true },
  });
  const route = own ? facilityByCode(own.code) : undefined;
  return route ? [route] : [];
}

/**
 * Resolve a lab page's slug to its facility row, or null when the slug is
 * unknown or the user may not read that lab — callers turn null into notFound().
 */
export async function resolveFacility(
  slug: string,
  user: SessionUser,
): Promise<{ route: FacilityRoute; id: string } | null> {
  const route = facilityBySlug(slug);
  if (!route) return null;
  const facility = await prisma.facility.findUnique({
    where: { code: route.code },
    select: { id: true },
  });
  if (!facility) return null;
  if (!user.canReadCrossSection && facility.id !== user.facilityId) return null;
  return { route, id: facility.id };
}

/** The slug for a user's own lab — where the bare /app/<module> path sends them. */
export async function ownFacilitySlug(user: SessionUser): Promise<FacilitySlug> {
  const own = await prisma.facility.findUnique({
    where: { id: user.facilityId },
    select: { code: true },
  });
  return (own && facilityByCode(own.code)?.slug) ?? "lahore";
}
