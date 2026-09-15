import { pkr } from "@/components/finance/money";

/**
 * Part-to-whole for a single total — where the money went. One stacked bar with
 * a 2px surface gap between segments, and every segment direct-labelled below
 * with its amount and share, so identity never rests on colour alone (two of the
 * four hues sit under 3:1 on a light surface, which obliges visible labels).
 *
 * Hues are slots 1-4 of the validated categorical order, used in fixed order:
 * worst adjacent CVD ΔE 9.1 (target ≥ 8), normal-vision ΔE 22.9 (floor ≥ 15).
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;

export type Slice = { key: string; label: string; value: number };

export function CompositionBar({
  slices,
  emptyLabel = "Nothing recorded yet.",
}: {
  slices: Slice[];
  emptyLabel?: string;
}) {
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((s, x) => s + x.value, 0);
  if (total <= 0)
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

  // Colour follows the entity's position in the full list, not its rank, so a
  // category dropping to zero never repaints the others.
  const toneOf = (key: string) =>
    SERIES[slices.findIndex((s) => s.key === key) % SERIES.length];

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {shown.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: PKR ${pkr(s.value)}`}
            style={{
              width: `${(s.value / total) * 100}%`,
              backgroundColor: toneOf(s.key),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: toneOf(s.key) }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {s.label}
            </span>
            <span className="tabular-nums">PKR {pkr(s.value)}</span>
            <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
