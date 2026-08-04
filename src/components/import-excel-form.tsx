"use client";

import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { importExcel, type ImportState } from "@/lib/actions/import";

export function ImportExcelForm({
  model,
  path,
  label,
  required,
  optional,
  money,
  autoFilled,
}: {
  model: string;
  path: string;
  /** What the operator calls these records, e.g. "clients". */
  label: string;
  required: string[];
  optional: string[];
  /** Columns written in PKR rupees (stored as paisa). */
  money: string[];
  autoFilled: string[];
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importExcel,
    {},
  );
  const [open, setOpen] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  // Plain links, not fetches: the browser handles the file download itself.
  const exportHref = `/api/export/${model}`;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Import from Excel
        </Button>
        <a href={exportHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Export to Excel
        </a>
      </div>
    );
  }

  const imported = state.imported ?? 0;
  const issues = state.issues ?? [];
  const clean = state.ran && !state.error && issues.length === 0;

  return (
    <div className="w-full space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Import {label} from Excel</h2>
          <p className="text-xs text-muted-foreground">
            Admin only. The header row must name Prisma fields. Check the file first — an
            import only goes through if every row is valid. Start from the{" "}
            <a
              href={`/api/export/${model}?template=1`}
              className="underline underline-offset-2"
            >
              blank template
            </a>{" "}
            or an{" "}
            <a href={exportHref} className="underline underline-offset-2">
              export of the current {label}
            </a>
            ; both use exactly the columns this importer expects.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="__model" value={model} />
        <input type="hidden" name="__path" value={path} />
        <input
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="max-w-[260px] text-xs file:mr-2 file:rounded file:border file:bg-muted file:px-2 file:py-1"
        />
        {(state.sheetNames?.length ?? 0) > 1 && (
          <select
            name="__sheet"
            defaultValue={state.sheetName}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {state.sheetNames!.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" name="__mode" value="validate" size="sm" variant="outline" disabled={pending}>
          {pending ? "Working…" : "Check file"}
        </Button>
        <Button type="submit" name="__mode" value="import" size="sm" disabled={pending}>
          Import
        </Button>
        <button
          type="button"
          onClick={() => setShowColumns((v) => !v)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          {showColumns ? "Hide" : "Show"} expected columns
        </button>
      </form>

      {showColumns && (
        <div className="space-y-1 rounded border bg-background p-3 text-xs">
          <p>
            <span className="font-medium">Required:</span>{" "}
            {required.length ? (
              <code className="font-mono">{required.join(", ")}</code>
            ) : (
              <span className="text-muted-foreground">none</span>
            )}
          </p>
          <p>
            <span className="font-medium">Optional:</span>{" "}
            <code className="font-mono text-muted-foreground">
              {optional.join(", ") || "none"}
            </code>
          </p>
          {money.length > 0 && (
            <p>
              <span className="font-medium">Amounts in PKR rupees:</span>{" "}
              <code className="font-mono">{money.join(", ")}</code> — write{" "}
              <span className="font-mono">1500</span> or{" "}
              <span className="font-mono">1500.50</span>, not paisa.
            </p>
          )}
          {autoFilled.length > 0 && (
            <p className="text-muted-foreground">
              <span className="font-medium">Filled in automatically:</span>{" "}
              <code className="font-mono">{autoFilled.join(", ")}</code> — leave these out.
            </p>
          )}
        </div>
      )}

      {state.ran && (
        <div className="space-y-2 rounded border bg-background p-3 text-xs">
          {state.error && <p className="font-medium text-red-600">{state.error}</p>}

          {imported > 0 && (
            <p className="font-medium text-green-700">
              Imported {imported} {label}.
            </p>
          )}

          {state.note && <p className="text-green-700">{state.note}</p>}

          {state.sheetName && (
            <p className="text-muted-foreground">
              Sheet <span className="font-mono">{state.sheetName}</span> ·{" "}
              {state.totalRows ?? 0} data row(s) · {state.validRows ?? 0} valid ·{" "}
              {state.matched?.length ?? 0} column(s) matched
              {state.matched?.length ? (
                <>
                  {" "}
                  (<span className="font-mono">{state.matched.join(", ")}</span>)
                </>
              ) : null}
            </p>
          )}

          {clean && imported === 0 && state.mode === "validate" && (
            <p className="font-medium text-green-700">
              Looks good — {state.validRows} row(s) ready. Press Import to commit.
            </p>
          )}

          {issues.length > 0 && (
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-muted-foreground">
                    <th className="w-16 py-1 font-medium">Row</th>
                    <th className="w-40 py-1 font-medium">Column</th>
                    <th className="py-1 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((iss, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1 font-mono">{iss.row ?? "header"}</td>
                      <td className="py-1 font-mono">{iss.column ?? "—"}</td>
                      <td className="py-1 text-red-600">{iss.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(state.moreIssues ?? 0) > 0 && (
                <p className="pt-1 text-muted-foreground">
                  …and {state.moreIssues} more.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
