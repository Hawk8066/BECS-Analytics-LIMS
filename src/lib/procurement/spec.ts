// Comparing a vendor's offered specification against what a PR line requested.
// Used by the on-screen comparative grid and the printed Form 6-B.

// True only when a vendor stated a spec that meaningfully differs from the one
// the PR requested. A blank offered spec (vendor didn't state one) is not a
// deviation. Whitespace/case-insensitive.
export function specDiffers(
  offered: string | null | undefined,
  requested: string | null | undefined,
): boolean {
  const norm = (s: string | null | undefined) =>
    (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const o = norm(offered);
  const r = norm(requested);
  return o !== "" && r !== "" && o !== r;
}
