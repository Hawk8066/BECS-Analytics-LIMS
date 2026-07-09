"use client";

import { useActionState, useState } from "react";
import {
  createPackage,
  updatePackageSectorPrice,
  deletePackage,
  type FormState,
} from "@/lib/actions/parameters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PackageData {
  id: string;
  name: string;
  parameters: string[]; // parameter names
  prices: Record<string, number>; // sector -> paisa
}

function PackageCard({
  pkg,
  sectors,
  canManage,
}: {
  pkg: PackageData;
  sectors: string[];
  canManage: boolean;
}) {
  const [sector, setSector] = useState(sectors[0] ?? "");
  const current = pkg.prices[sector];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{pkg.name}</CardTitle>
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
          {sectors.map((s) =>
            pkg.prices[s] != null ? (
              <span key={s} className="rounded bg-muted px-2 py-0.5">
                {s}: PKR {(pkg.prices[s] / 100).toLocaleString("en-PK")}
              </span>
            ) : null,
          )}
        </div>
        {canManage && (
          <form action={updatePackageSectorPrice} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="packageId" value={pkg.id} />
            <select
              name="sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-sm"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Input
              key={sector}
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={current != null ? current / 100 : ""}
              className="h-8 w-32"
              placeholder="Price (PKR)"
            />
            <Button size="sm" type="submit">
              Save
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CreatePackage({
  parameters,
}: {
  parameters: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPackage,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New package</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Package name</Label>
            <Input id="name" name="name" placeholder="e.g. Basic Fertilizer Panel" required />
          </div>
          <div className="grid gap-1.5">
            <Label>Parameters</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
              {parameters.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="parameterIds" value={p.id} className="size-4" />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create package"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function Packages({
  sectors,
  parameters,
  packages,
  canManage,
}: {
  sectors: string[];
  parameters: { id: string; name: string }[];
  packages: PackageData[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-6">
      {packages.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} sectors={sectors} canManage={canManage} />
      ))}
      {packages.length === 0 && (
        <p className="text-sm text-muted-foreground">No packages yet.</p>
      )}
      {canManage && <CreatePackage parameters={parameters} />}
    </div>
  );
}
