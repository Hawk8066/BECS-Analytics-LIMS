"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PRForm, type InitialRow } from "@/app/app/procurement/pr-form";
import { requestIssues } from "@/lib/actions/reorder";
import { useSelection } from "./reorder-selection";

type CatalogItem = {
  name: string;
  category: string;
  pack: string;
  spec: string;
};
type StoreOption = { id: string; name: string };

// Tab-row controls. Idle: "Issue request" + "Generate PR" start selection mode.
// Active: a count + the matching "Create …" (opens a pre-filled modal for the
// ticked items) + "Cancel". Both flows work for a single item or many.
export function StoreActions({
  rowData,
  catalog,
  destinations,
  defaultToStoreId,
  requesterName,
  showIssue,
}: {
  rowData: Record<string, InitialRow>;
  catalog: CatalogItem[];
  destinations: StoreOption[];
  defaultToStoreId?: string;
  requesterName: string;
  showIssue: boolean;
}) {
  const { mode, start, cancel, selected } = useSelection();
  const [prOpen, setPrOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  if (mode === null) {
    return (
      <>
        {showIssue && (
          <Button
            variant="outline"
            size="sm"
            disabled={destinations.length === 0}
            onClick={() => start("issue")}
          >
            Issue request
          </Button>
        )}
        <Button size="sm" onClick={() => start("pr")}>
          Generate PR
        </Button>
      </>
    );
  }

  const ids = [...selected];
  const prRows = ids
    .map((id) => rowData[id])
    .filter((r): r is InitialRow => Boolean(r));
  const issueRows = ids
    .map((id) => {
      const r = rowData[id];
      return r ? { id, name: r.description, qty: r.quantity ?? "1" } : null;
    })
    .filter((r): r is { id: string; name: string; qty: string } => r !== null);

  return (
    <>
      <span className="text-sm text-muted-foreground">
        {selected.size} selected
      </span>
      {mode === "pr" ? (
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={() => setPrOpen(true)}
        >
          Create PR
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={() => setIssueOpen(true)}
        >
          Create issue request
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={cancel}>
        Cancel
      </Button>

      {prOpen && (
        <Modal
          title="Purchase Requisition"
          onClose={() => setPrOpen(false)}
          className="max-w-5xl"
        >
          <PRForm items={catalog} initialRows={prRows} />
        </Modal>
      )}

      {issueOpen && (
        <Modal
          title="Issue request"
          onClose={() => setIssueOpen(false)}
          className="max-w-lg"
        >
          <form
            action={requestIssues}
            onSubmit={() => {
              setIssueOpen(false);
              cancel();
            }}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label>Requested by</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {requesterName}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="toStoreId">Issue to</Label>
              <select
                id="toStoreId"
                name="toStoreId"
                defaultValue={defaultToStoreId}
                required
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                {destinations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Requested from the main store; a store in-charge approves the
                transfer.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>Items</Label>
              <div className="divide-y rounded-md border">
                {issueRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-2">
                    <span className="flex-1 text-sm">{r.name}</span>
                    <input type="hidden" name="description" value={r.name} />
                    <Input
                      name="quantity"
                      type="number"
                      min="1"
                      defaultValue={r.qty}
                      className="h-8 w-24"
                      aria-label={`Quantity for ${r.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIssueOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create request
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
