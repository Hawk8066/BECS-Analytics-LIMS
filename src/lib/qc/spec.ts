/**
 * Acceptance judgement for a QC result.
 *
 * Extracted from the result-entry action so the bulk importer judges a lot by
 * exactly the same rule a typed one is judged by. A spreadsheet column carrying
 * its own PASS/FAIL could drift from the product's spec; this cannot.
 *
 * No spec configured means no verdict — the value is recorded but not judged,
 * which is deliberate: silently passing an unjudgeable lot would be worse than
 * leaving it blank.
 */
export function judge(
  value: number,
  specMin: number | null,
  specMax: number | null,
): "PASS" | "FAIL" | null {
  if (specMin == null && specMax == null) return null;
  if (specMin != null && value < specMin) return "FAIL";
  if (specMax != null && value > specMax) return "FAIL";
  return "PASS";
}
