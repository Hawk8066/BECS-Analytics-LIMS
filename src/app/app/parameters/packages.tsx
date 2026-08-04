"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createPackage,
  getPackagePriceHistory,
  updatePackagePrice,
  deletePackage,
  type FormState,
} from "@/lib/actions/parameters";
import { PriceTrail } from "./price-history";
import { priceAt, type PriceEntry } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

export interface PackageData {
  id: string;
  name: string;
  matrix: string | null; // the matrix this package is filed under
  parameters: string[]; // parameter names
  price: PriceEntry; // { normal, urgent } in paisa — one price per package
  lastSet?: string; // ISO date the price was last set
}

const pkr = (paisa: number | null) =>
  paisa == null ? "—" : `PKR ${(paisa / 100).toLocaleString("en-PK")}`;

function PackageCard({ pkg, canManage }: { pkg: PackageData; canManage: boolean }) {
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const entry = pkg.price;
  // The saved rate for this grade (blank box ⇒ keep the default, don't lock it in).
  const current = priority === "URGENT" ? entry.urgent : entry.normal;
  // The effective urgent figure (normal +50%) to hint when none is saved.
  const autoUrgent =
    priority === "URGENT" && entry.urgent == null ? priceAt(entry, "URGENT") : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            {pkg.name}
            {pkg.matrix && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {pkg.matrix}
              </span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {pkg.parameters.join(", ") || "No parameters"}
          </p>
        </div>
        {canManage && (
          <form
            action={deletePackage}
            onSubmit={(e) => {
              if (!confirm(`Delete package "${pkg.name}"?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="packageId" value={pkg.id} />
            <Button size="sm" variant="ghost" type="submit" className="text-red-600">
              Delete
            </Button>
          </form>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-0.5">Normal: {pkr(entry.normal)}</span>
          <span className="rounded bg-muted px-2 py-0.5">
            Urgent: {pkr(priceAt(entry, "URGENT"))}
            {entry.urgent == null && entry.normal != null ? " (auto +50%)" : ""}
          </span>
        </div>
        {canManage && (
          <div className="space-y-1">
            <form action={updatePackagePrice} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="packageId" value={pkg.id} />
              <select
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "NORMAL" | "URGENT")}
                className="h-8 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
              </select>
              <Input
                key={priority}
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={current != null ? current / 100 : ""}
                className="h-8 w-32"
                placeholder={
                  autoUrgent != null
                    ? `${(autoUrgent / 100).toLocaleString("en-PK")} (auto +50%)`
                    : "Price (PKR)"
                }
              />
              <Button size="sm" type="submit">
                Save
              </Button>
            </form>
            <PriceTrail
              updatedAt={pkg.lastSet}
              load={() => getPackagePriceHistory(pkg.id)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreatePackage({
  parameters,
  onDone,
}: {
  parameters: { id: string; name: string; matrix: string | null }[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPackage,
    {},
  );

  const [query, setQuery] = useState("");

  // Close once the package is created; the list below refreshes via the action's
  // revalidatePath.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  // Distinct matrices in use, to file the package under one.
  const matrices = useMemo(
    () =>
      [...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m))].sort(),
    [parameters],
  );

  // Group the parameter picker by matrix, filtered by the matrix search box.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? parameters.filter((p) => p.matrix?.toLowerCase().includes(q))
      : parameters;
    const m = new Map<string, typeof parameters>();
    for (const p of [...matches].sort(
      (a, b) =>
        (a.matrix ?? "~").localeCompare(b.matrix ?? "~") ||
        a.name.localeCompare(b.name),
    )) {
      const key = p.matrix || "— (no matrix)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return [...m.entries()];
  }, [parameters, query]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Package name</Label>
          <Input id="name" name="name" placeholder="e.g. Basic Fertilizer Panel" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-matrix">Matrix (files the package)</Label>
          <select
            id="pkg-matrix"
            name="matrix"
            defaultValue=""
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— none —</option>
            {matrices.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-price">Price, normal (PKR)</Label>
          <Input
            id="pkg-price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="optional"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pkg-urgent">Price, urgent (PKR)</Label>
          <Input
            id="pkg-urgent"
            name="urgentPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="normal +50%"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Parameters</Label>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search matrix…"
            aria-label="Search parameters by matrix"
            className="h-8 w-52"
          />
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-3">
          {groups.map(([matrix, list]) => (
            <div key={matrix}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {matrix} ({list.length})
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {list.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="parameterIds"
                      value={p.id}
                      className="size-4"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matrix matches “{query.trim()}”.
            </p>
          )}
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create package"}
        </Button>
      </div>
    </form>
  );
}

export function Packages({
  parameters,
  packages,
  canManage,
}: {
  parameters: { id: string; name: string; matrix: string | null }[];
  packages: PackageData[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>New package</Button>
        </div>
      )}
      {packages.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} canManage={canManage} />
      ))}
      {packages.length === 0 && (
        <p className="text-sm text-muted-foreground">No packages yet.</p>
      )}
      {creating && (
        <Modal title="New package" onClose={() => setCreating(false)} className="max-w-3xl">
          <CreatePackage parameters={parameters} onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
