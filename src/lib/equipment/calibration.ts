// Calibration validity (SSOT BR-13/BR-17). Exposes a flag, not a hard block —
// Testing allows results on out-of-calibration instruments but flags them.
export type CalStatus = "VALID" | "EXPIRED" | "NONE";

export function calStatus(
  validUntil: Date | null | undefined,
  asOf: Date = new Date(),
): CalStatus {
  if (!validUntil) return "NONE";
  return validUntil >= asOf ? "VALID" : "EXPIRED";
}
