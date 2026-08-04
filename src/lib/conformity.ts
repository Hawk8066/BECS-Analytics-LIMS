/**
 * Conformity: judging a test result against a standard's acceptance limit.
 *
 * A limit is a pair of nullable bounds — max only ("≤"), min only ("≥"), both
 * ("between"), or neither (no limit). Bounds are inclusive: a value equal to a
 * bound conforms. Sample results are stored as free text, so a non-numeric
 * result (e.g. "ND", "< 0.01") can't be judged and is left unjudged (null).
 *
 * This mirrors the Production-QC spec logic (lib/actions/production-qc.ts) but
 * speaks the sample domain's CONFORM / NON_CONFORM verdict.
 */

export type Conformity = "CONFORM" | "NON_CONFORM";

/**
 * The verdict for `resultValue` against `[min, max]`, or null when there is no
 * limit or the result isn't numeric. Inclusive bounds.
 */
export function judgeConformity(
  resultValue: string | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): Conformity | null {
  if (min == null && max == null) return null; // no limit to judge against
  const value = Number(String(resultValue ?? "").trim());
  if (!Number.isFinite(value)) return null; // non-numeric result — not judged
  if (min != null && value < min) return "NON_CONFORM";
  if (max != null && value > max) return "NON_CONFORM";
  return "CONFORM";
}

/**
 * Human-readable limit, e.g. "≤ 5 %", "≥ 2 %", "2–5 %", or "" when unset.
 * (Same shape as production/page.tsx's `specText`.)
 */
export function limitText(
  min: number | null | undefined,
  max: number | null | undefined,
  unit?: string | null,
): string {
  // A lone dash is the "dimensionless / no unit" placeholder — don't append it.
  const t = unit?.trim();
  const u = t && t !== "-" && t !== "–" && t !== "—" ? ` ${t}` : "";
  if (min == null && max == null) return "";
  if (min != null && max != null) return `${min}–${max}${u}`;
  if (min != null) return `≥ ${min}${u}`;
  return `≤ ${max}${u}`;
}
