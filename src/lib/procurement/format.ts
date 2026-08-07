// How a requested line's quantity + pack size reads on requisitions, the
// comparative and POs — e.g. "1 × 500 mL" (one 500 mL pack) or "3 pcs".

export function packQtyLabel(
  quantity: number,
  packSize: string | null | undefined,
  unit: string | null | undefined,
): string {
  const u = (unit ?? "").trim();
  const p = (packSize ?? "").trim();
  if (p) return `${quantity} × ${p}${u ? ` ${u}` : ""}`;
  return `${quantity}${u ? ` ${u}` : ""}`;
}
