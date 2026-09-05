import type { Designation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CAPABILITIES, isDefaultSet } from "@/lib/auth/capabilities";

/**
 * Cache for the admin-configurable capability matrix.
 *
 * `perms.ts` exposes synchronous predicates (`canViewFinance(designation)`) that
 * are called from ~94 server files, many inside JSX. Making them async would
 * touch every call site, so instead the overrides are held in a module-level
 * cache that is warmed once per request by `getSessionUser()` — which every page
 * and server action already calls before any capability check runs.
 *
 * Absent from the cache => the capability uses its built-in default, so a cold
 * cache degrades to the original hard-coded matrix rather than to "deny all".
 *
 * The cache is per Node process and invalidated on write. That is correct for
 * the single-instance on-prem deployment; a multi-instance rollout would need a
 * short TTL or a pub/sub invalidation.
 */

type Overrides = Map<string, Designation[]>;

let cache: Overrides | null = null;
let inflight: Promise<Overrides> | null = null;

async function load(): Promise<Overrides> {
  const rows = await prisma.capabilityGrant.findMany({
    select: { capability: true, designations: true },
  });
  const map: Overrides = new Map();
  for (const r of rows) map.set(r.capability, r.designations);
  cache = map;
  return map;
}

/** Warm the cache. Safe to call on every request; loads at most once. */
export async function ensureCapabilitiesLoaded(): Promise<void> {
  if (cache) return;
  // Collapse concurrent first-hits onto a single query.
  if (!inflight) inflight = load().finally(() => (inflight = null));
  try {
    await inflight;
  } catch {
    // A DB hiccup must not lock everyone out: fall back to the defaults.
    cache = new Map();
  }
}

/** Drop the cache so the next request reloads it (call after any write). */
export function invalidateCapabilities(): void {
  cache = null;
}

/**
 * Synchronous capability test used by `perms.ts`. ADMIN always passes; anything
 * not overridden falls back to the built-in default set.
 */
export function hasCapability(key: string, designation: Designation): boolean {
  if (designation === "ADMIN") return true;
  const override = cache?.get(key);
  if (override) return override.includes(designation);
  const def: readonly Designation[] =
    CAPABILITIES.find((c) => c.key === key)?.defaults ?? [];
  return def.includes(designation);
}

/** The effective (override or default) designation set for one capability. */
export function effectiveDesignations(key: string): readonly Designation[] {
  const override = cache?.get(key);
  if (override) return override;
  return CAPABILITIES.find((c) => c.key === key)?.defaults ?? [];
}

/** Effective matrix for the admin screen — always reads fresh from the DB. */
export async function readMatrix(): Promise<
  Record<string, { designations: Designation[]; customised: boolean }>
> {
  const rows = await prisma.capabilityGrant.findMany({
    select: { capability: true, designations: true },
  });
  const overrides = new Map(rows.map((r) => [r.capability, r.designations]));
  const out: Record<
    string,
    { designations: Designation[]; customised: boolean }
  > = {};
  for (const c of CAPABILITIES) {
    const o = overrides.get(c.key);
    out[c.key] = {
      designations: o ?? [...c.defaults],
      customised: o != null && !isDefaultSet(c.key, o),
    };
  }
  return out;
}
