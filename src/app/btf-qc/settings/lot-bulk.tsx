"use client";

import { useActionState, useState } from "react";
import {
  importQcLots,
  resetQcLots,
  type LotImportState,
  type ResetState,
} from "@/lib/actions/qc-bulk";
import { RESET_PHRASE } from "@/lib/qc/constants";
import { LOT_COLUMNS } from "@/lib/qc/lot-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Issues({ state }: { state: LotImportState }) {
  if (!state.issues?.length) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-900">
        {state.issues.length + (state.moreIssues ?? 0)} row
        {state.issues.length + (state.moreIssues ?? 0) === 1 ? "" : "s"} need attention
      </p>
      <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-amber-900">
        {state.issues.map((i, n) => (
          <li key={n}>
            Row {i.row}
            {i.column ? ` · ${i.column}` : ""}: {i.message}
          </li>
        ))}
      </ul>
      {!!state.moreIssues && (
        <p className="mt-1 text-xs text-amber-800">
          …and {state.moreIssues} more.
        </p>
      )}
    </div>
  );
}

/**
 * Bulk-load QC lots, and clear the register between trial loads.
 *
 * Validate and import are the same upload with a different mode, so what you
 * check is exactly what you commit — there is no second file to get out of step.
 */
export function LotBulkTools({ hasProducts }: { hasProducts: boolean }) {
  const [imp, importAction, importing] = useActionState<LotImportState, FormData>(
    importQcLots,
    {},
  );
  const [reset, resetAction, resetting] = useActionState<ResetState, FormData>(
    resetQcLots,
    {},
  );
  const [confirm, setConfirm] = useState("");

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk import lots</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!hasProducts ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add a product type first — a lot has to belong to one, and the
              sheet names its product rather than carrying an id.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                One row per lot. The <strong>Product</strong> column must match a
                product type by name. Lot numbers are generated from the same
                counter the booking form uses, and PASS/FAIL is judged by each
                product&apos;s own spec rather than read from the sheet.
              </p>

              <p className="text-xs text-muted-foreground">
                Columns:{" "}
                {LOT_COLUMNS.map((c) => (
                  <span key={c.key} className="font-mono">
                    {c.label}
                    {c.required ? "*" : ""}{" "}
                  </span>
                ))}
                {/* A plain anchor, not next/link: this is a route handler
                    returning an .xlsx, so it must be a real browser download
                    rather than a client-side navigation. */}
                <a
                  href="/btf-qc/settings/template"
                  download
                  className="ml-1 underline"
                >
                  Download template
                </a>
              </p>

              {/* One form, two submit buttons: the mode decides whether the
                  parsed rows are written or only reported. */}
              <form action={importAction} className="grid gap-3">
                <Input
                  type="file"
                  name="file"
                  accept=".xlsx"
                  required
                  className="max-w-md"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    name="mode"
                    value="validate"
                    variant="outline"
                    size="sm"
                    disabled={importing}
                  >
                    {importing ? "Checking…" : "Check file"}
                  </Button>
                  <Button
                    type="submit"
                    name="mode"
                    value="import"
                    size="sm"
                    disabled={importing}
                  >
                    {importing ? "Importing…" : "Import"}
                  </Button>
                </div>
              </form>

              {imp.error && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {imp.error}
                </p>
              )}

              {imp.ran && !imp.error && (
                <p className="text-sm">
                  {imp.mode === "import" ? (
                    <>
                      Imported <strong>{imp.imported ?? 0}</strong> of{" "}
                      {imp.totalRows ?? 0} rows.
                    </>
                  ) : (
                    <>
                      <strong>{imp.validRows ?? 0}</strong> of {imp.totalRows ?? 0}{" "}
                      rows are ready to import. Nothing has been written yet.
                    </>
                  )}
                </p>
              )}
              <Issues state={imp} />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">Reset lots</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Deletes <strong>every</strong> QC lot, and the monthly consolidated
            invoices raised from them — including their journal entries, so the
            ledger stays balanced. Intended for clearing test data between trial
            imports, not for correcting a live register.
          </p>
          <p className="text-sm text-muted-foreground">
            An invoice with a payment recorded against it is refused: money
            received cannot be un-invoiced here.
          </p>

          <form action={resetAction} className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <label htmlFor="confirm" className="text-xs text-muted-foreground">
                Type <span className="font-mono font-medium">{RESET_PHRASE}</span> to confirm
              </label>
              <Input
                id="confirm"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                className="max-w-xs font-mono"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={resetting || confirm.trim() !== RESET_PHRASE}
            >
              {resetting ? "Deleting…" : "Reset lots"}
            </Button>
          </form>

          {reset.error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {reset.error}
            </p>
          )}
          {reset.ran && !reset.error && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Deleted {reset.deletedLots ?? 0} lot
              {reset.deletedLots === 1 ? "" : "s"}
              {!!reset.deletedInvoices && (
                <>
                  , {reset.deletedInvoices} invoice
                  {reset.deletedInvoices === 1 ? "" : "s"} and{" "}
                  {reset.deletedEntries ?? 0} journal entr
                  {reset.deletedEntries === 1 ? "y" : "ies"}
                </>
              )}
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
