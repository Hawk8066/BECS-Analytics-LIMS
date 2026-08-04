"use client";

/**
 * "Last set <date>" plus the dated price trail behind it, shared by parameter
 * and package prices — both answer the same question: when did this figure
 * change, from what, and who changed it.
 *
 * The trail loads only when opened, so a table of hundreds of rows costs
 * nothing until someone actually asks about a price.
 */
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/format";
import type { PriceHistoryEntry } from "@/lib/actions/parameters";

export const money = (paisa: number | null) =>
  paisa === null ? "—" : `PKR ${(paisa / 100).toLocaleString("en-PK")}`;

const SOURCE_LABEL: Record<PriceHistoryEntry["source"], string> = {
  MANUAL: "entered here",
  IMPORT: "uploaded file",
  BACKFILL: "recorded from the existing price",
  CORRECTION: "data correction",
};

export function PriceTrail({
  updatedAt,
  load,
  version = 0,
}: {
  /** ISO date this price was last saved; absent if it has never been saved. */
  updatedAt?: string;
  load: () => Promise<PriceHistoryEntry[]>;
  /** Bump after a save to refresh an open trail. */
  version?: number;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<PriceHistoryEntry[] | null>(null);

  // `load` is an inline closure over the current row, so it changes identity on
  // every render; keep the latest in a ref rather than in the effect's deps.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadRef.current().then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, version]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{updatedAt ? `Last set ${formatDate(updatedAt)}` : "Not saved yet"}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="underline underline-offset-2"
        >
          {open ? "Hide history" : "History"}
        </button>
      </div>

      {open && (
        <div className="rounded border bg-background p-2">
          {entries === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No changes logged yet for this sector.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                  <span className="font-mono text-foreground">{formatDate(e.changedAt)}</span>
                  <span className={e.priority === "URGENT" ? "text-foreground" : undefined}>
                    {e.priority === "URGENT" ? "urgent" : "normal"}
                  </span>
                  <span>
                    {e.oldPrice === null ? "set to" : `${money(e.oldPrice)} →`}{" "}
                    <span className="text-foreground">{money(e.price)}</span>
                  </span>
                  <span>
                    ({SOURCE_LABEL[e.source]}
                    {e.by ? ` · ${e.by}` : ""})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
