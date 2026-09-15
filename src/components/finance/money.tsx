import { cn } from "@/lib/utils";

// Shared money presentation for the finance pages. Amounts are PKR paisa.

export function pkr(paisa: number): string {
  return (paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "PKR 12,345.00" — negatives keep the sign in front of the currency. */
export function Money({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      {value < 0 ? "−" : ""}PKR {pkr(Math.abs(value))}
    </span>
  );
}

/** Small uppercase divider inside a statement card. */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** One label/amount line; `hint` explains what the figure covers. */
export function Row({
  label,
  value,
  hint,
  bold,
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-4 py-1 text-sm", bold && "font-semibold")}>
      <span className={cn("min-w-0", !bold && "text-muted-foreground")}>
        {label}
        {hint && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({hint})
          </span>
        )}
      </span>
      <Money value={value} />
    </div>
  );
}
