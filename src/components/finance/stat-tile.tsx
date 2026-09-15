import Link from "next/link";

// Headline figures for the finance pages. A tile is a number, not a chart: the
// tone is a small accent mark beside the label, never the colour of the text —
// the figure itself stays in ink so it reads at any contrast.

/** Whole rupees — tiles are headlines; the paisa live in the statements rows. */
function pkrWhole(paisa: number): string {
  return (paisa / 100).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

export function TileRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
  hint,
  href,
}: {
  label: string;
  /** PKR paisa. */
  value: number;
  /** Accent hue for the label dot. */
  tone: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums">
        {value < 0 ? "−" : ""}PKR {pkrWhole(Math.abs(value))}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = "rounded-lg border bg-card p-3";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-muted/50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
