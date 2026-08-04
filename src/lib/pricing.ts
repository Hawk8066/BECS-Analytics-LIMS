/**
 * Parameter & package pricing.
 *
 * A parameter (and a package) carries one price, at two grades: NORMAL and
 * URGENT (rush work). Pricing is NOT per sector — sector classifies the client,
 * not the price. Where no urgent rate is set, urgent work is charged a fixed
 * uplift on the normal rate (URGENT_UPLIFT); that fallback lives in `priceAt`,
 * so no caller has to remember it and a hand-entered urgent price always wins.
 *
 * All amounts are PKR paisa, matching the schema and the /100 done at display.
 */

export type PricePriority = "NORMAL" | "URGENT";

/** How a priority reads on screen. Stored uppercase, shown in sentence case. */
export const priorityLabel = (p: string | null | undefined) =>
  p === "URGENT" ? "Urgent" : p === "NORMAL" ? "Normal" : (p ?? "—");

/** The two rates for one parameter/package; null means "not priced". */
export interface PriceEntry {
  normal: number | null;
  urgent: number | null;
}

/**
 * Default premium for urgent work when no explicit urgent rate is set: the
 * normal rate + 50%. An explicit urgent price overrides this. Kept as one
 * constant so the rule is easy to see and to change.
 */
export const URGENT_UPLIFT = 1.5;

/** Normal rate -> the urgent rate it implies (whole paisa). */
export function urgentFrom(normal: number | null): number | null {
  return normal === null ? null : Math.round(normal * URGENT_UPLIFT);
}

/** Build a PriceEntry from a row that stores `price` / `urgentPrice`. */
export function priceEntry(row: {
  price: number | null;
  urgentPrice: number | null;
}): PriceEntry {
  return { normal: row.price, urgent: row.urgentPrice };
}

/**
 * What a line costs at the requested priority. Urgent uses the explicit urgent
 * rate where one is set, otherwise the normal rate plus the standard uplift.
 */
export function priceAt(
  entry: PriceEntry | undefined,
  priority: PricePriority,
): number | null {
  if (!entry) return null;
  if (priority === "URGENT") return entry.urgent ?? urgentFrom(entry.normal);
  return entry.normal;
}

/** True when neither rate is set. */
export function isUnpriced(entry: PriceEntry | undefined): boolean {
  return !entry || (entry.normal === null && entry.urgent === null);
}
