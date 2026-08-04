"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuotation, type FormState } from "@/lib/actions/quotations";
import { createClient, type FormState as ClientFormState } from "@/lib/actions/clients";
import { priceAt, type PriceEntry, type PricePriority } from "@/lib/pricing";
import { SECTORS } from "@/lib/sectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Modal } from "@/components/ui/modal";
import { ParameterForm } from "../parameters/parameter-form";

interface ParamOpt {
  id: string;
  name: string;
  unit: string | null;
  matrix: string | null;
  price: PriceEntry; // { normal, urgent } — one price per parameter
}
interface PackageOpt {
  id: string;
  name: string;
  matrix: string | null;
  parameterIds: string[];
  price: PriceEntry;
}

function pkr(paisa: number | undefined): string {
  return paisa != null ? `PKR ${(paisa / 100).toLocaleString("en-PK")}` : "—";
}

/** Services sales-tax rates offered on a quote (whole percent; 0 = none). */
const TAX_RATES = [0, 5, 15, 16] as const;

export function QuotationForm({
  clients,
  matrices,
  units,
  parameters,
  packages,
  canAddClient,
  canAddParameter,
}: {
  clients: { id: string; label: string; sector: string | null }[];
  matrices: string[];
  units: string[];
  parameters: ParamOpt[];
  packages: PackageOpt[];
  canAddClient: boolean;
  canAddParameter: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createQuotation,
    {},
  );
  const [sector, setSector] = useState("");
  const [clientId, setClientId] = useState("");
  // Quotes are priced off one rate card: standard work or rush work.
  const [priority, setPriority] = useState<PricePriority>("NORMAL");
  const [qty, setQty] = useState(1);
  const [matrix, setMatrix] = useState("");
  const [paramQuery, setParamQuery] = useState("");
  const [params, setParams] = useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = useState<Set<string>>(new Set());
  // Per-row discount, keyed by "KIND:id", entered in rupees.
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [taxPct, setTaxPct] = useState(0);
  // Inline create shortcuts. On success we refresh the route so the new client
  // or parameter flows into the lists below — without losing this quote.
  const [addingClient, setAddingClient] = useState(false);
  const [addingParameter, setAddingParameter] = useState(false);

  const paramById = useMemo(() => new Map(parameters.map((p) => [p.id, p])), [parameters]);

  // Sector list from the clients that exist; picking one filters the client list.
  const sectorOptions = useMemo(
    () => [...new Set(clients.map((c) => c.sector).filter((s): s is string => !!s))].sort(),
    [clients],
  );
  const visibleClients = useMemo(
    () => (sector ? clients.filter((c) => c.sector === sector) : clients),
    [clients, sector],
  );

  // Packages are filed under a matrix — show only the selected matrix's.
  const matrixPackages = useMemo(
    () => (matrix ? packages.filter((p) => p.matrix === matrix) : []),
    [matrix, packages],
  );

  // Parameters already covered by a selected package aren't shown or charged
  // again on their own.
  const coveredParamIds = useMemo(() => {
    const s = new Set<string>();
    for (const id of pkgs)
      packages.find((p) => p.id === id)?.parameterIds.forEach((pid) => s.add(pid));
    return s;
  }, [pkgs, packages]);

  const matrixParams = useMemo(
    () =>
      matrix
        ? parameters.filter((p) => p.matrix === matrix && !coveredParamIds.has(p.id))
        : [],
    [matrix, parameters, coveredParamIds],
  );
  const shownParams = useMemo(() => {
    const q = paramQuery.trim().toLowerCase();
    return q ? matrixParams.filter((p) => p.name.toLowerCase().includes(q)) : matrixParams;
  }, [matrixParams, paramQuery]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const selectedPackages = useMemo(
    () =>
      [...pkgs]
        .map((id) => packages.find((p) => p.id === id))
        .filter((p): p is PackageOpt => !!p),
    [pkgs, packages],
  );
  const selectedParams = useMemo(
    () =>
      [...params]
        .filter((id) => !coveredParamIds.has(id))
        .map((id) => paramById.get(id))
        .filter((p): p is ParamOpt => !!p),
    [params, coveredParamIds, paramById],
  );

  const lineKey = (kind: "PACKAGE" | "PARAMETER", id: string) => `${kind}:${id}`;
  const discPaisa = (k: string, price: number) => {
    const v = Number(discounts[k]);
    return Number.isFinite(v) && v > 0 ? Math.min(price, Math.round(v * 100)) : 0;
  };

  // The selected lines: packages (with their parameter breakdown), then any
  // individually-picked parameter not already inside a selected package.
  const lines = useMemo(() => {
    const rows: {
      key: string;
      kind: "PACKAGE" | "PARAMETER";
      id: string;
      name: string;
      sub?: string[];
      price: number;
    }[] = [];
    for (const pk of selectedPackages)
      rows.push({
        key: lineKey("PACKAGE", pk.id),
        kind: "PACKAGE",
        id: pk.id,
        name: pk.name,
        sub: pk.parameterIds
          .map((pid) => paramById.get(pid)?.name)
          .filter((n): n is string => !!n),
        price: priceAt(pk.price, priority) ?? 0,
      });
    for (const p of selectedParams)
      rows.push({
        key: lineKey("PARAMETER", p.id),
        kind: "PARAMETER",
        id: p.id,
        name: p.matrix ? `${p.name} (${p.matrix})` : p.name,
        price: priceAt(p.price, priority) ?? 0,
      });
    return rows;
  }, [selectedPackages, selectedParams, priority, paramById]);

  const perSample = lines.reduce((s, l) => s + (l.price - discPaisa(l.key, l.price)), 0);
  const netTotal = perSample * Math.max(1, qty);
  const taxAmount = Math.round((netTotal * taxPct) / 100);
  const total = netTotal + taxAmount;

  return (
    <>
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="q-sector">Sector</Label>
          <select
            id="q-sector"
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setClientId(""); // the client list changes; re-pick
            }}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All sectors</option>
            {sectorOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="clientId">Client</Label>
            {canAddClient && (
              <button
                type="button"
                onClick={() => setAddingClient(true)}
                className="text-xs text-primary underline underline-offset-2"
              >
                + New client
              </button>
            )}
          </div>
          <select
            id="clientId"
            name="clientId"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="" disabled>
              {visibleClients.length === 0 ? "No clients in this sector" : "Select…"}
            </option>
            {visibleClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority (rate card)</Label>
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as PricePriority)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="matrix">Matrix (filters parameters &amp; packages)</Label>
            {canAddParameter && (
              <button
                type="button"
                onClick={() => setAddingParameter(true)}
                className="text-xs text-primary underline underline-offset-2"
              >
                + New parameter
              </button>
            )}
          </div>
          <select
            id="matrix"
            value={matrix}
            onChange={(e) => setMatrix(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Select matrix…</option>
            {matrices.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 grid gap-2">
          <Label htmlFor="sampleType">Sample type</Label>
          <Input id="sampleType" name="sampleType" placeholder="e.g. Zabardast Urea" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sampleQty">Quantity (samples)</Label>
          <Input
            id="sampleQty"
            name="sampleQty"
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      {matrix && matrixPackages.length > 0 && (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Packages ({matrix})</legend>
          {matrixPackages.map((pkg) => (
            <label key={pkg.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pkgs.has(pkg.id)}
                onChange={() => setPkgs((s) => toggle(s, pkg.id))}
              />
              <span className="font-medium">{pkg.name}</span>
              <span className="text-xs text-muted-foreground">
                ({pkg.parameterIds.length} params)
              </span>
              <span className="ml-auto">{pkr(priceAt(pkg.price, priority) ?? undefined)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {matrix ? (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <legend className="px-1 text-sm font-medium">Parameters ({matrix})</legend>
            {matrixParams.length > 0 && (
              <Input
                type="search"
                value={paramQuery}
                onChange={(e) => setParamQuery(e.target.value)}
                placeholder="Search parameter…"
                aria-label="Search parameters"
                className="h-8 w-48"
              />
            )}
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {shownParams.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={params.has(p.id)}
                  onChange={() => setParams((s) => toggle(s, p.id))}
                />
                <span>{p.name}</span>
                {p.unit && <span className="text-muted-foreground">({p.unit})</span>}
                <span className="ml-auto text-muted-foreground">
                  {pkr(priceAt(p.price, priority) ?? undefined)}
                </span>
              </label>
            ))}
            {matrixParams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No parameters to add for this matrix.
              </p>
            )}
            {matrixParams.length > 0 && shownParams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No parameter matches “{paramQuery.trim()}”.
              </p>
            )}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Select a matrix to choose parameters and packages.
        </p>
      )}

      {/* Selected lines — a discount is set per row (package or parameter). */}
      {lines.length > 0 ? (
        <div className="grid gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">Selected ({lines.length})</p>
          <div className="space-y-2">
            {lines.map((l) => {
              const disc = discPaisa(l.key, l.price);
              return (
                <div key={l.key} className="space-y-0.5 border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">
                      {l.name}
                      {l.kind === "PACKAGE" && (
                        <span className="ml-1 text-xs text-muted-foreground">(package)</span>
                      )}
                    </span>
                    <span className="w-20 text-right tabular-nums text-muted-foreground">
                      {pkr(l.price)}
                    </span>
                    <span className="text-xs text-muted-foreground">−</span>
                    <input
                      name={`discount_${l.kind}_${l.id}`}
                      type="number"
                      min="0"
                      max={l.price / 100}
                      step="0.01"
                      value={discounts[l.key] ?? ""}
                      onChange={(e) =>
                        setDiscounts((d) => ({ ...d, [l.key]: e.target.value }))
                      }
                      placeholder="0"
                      className="h-8 w-20 rounded-md border bg-transparent px-2 text-right text-sm"
                    />
                    <span className="w-20 text-right font-medium tabular-nums">
                      {pkr(l.price - disc)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        l.kind === "PACKAGE"
                          ? setPkgs((s) => toggle(s, l.id))
                          : setParams((s) => toggle(s, l.id))
                      }
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${l.name}`}
                    >
                      ✕
                    </button>
                  </div>
                  {l.sub && l.sub.length > 0 && (
                    <p className="pl-1 text-xs text-muted-foreground">{l.sub.join(", ")}</p>
                  )}
                </div>
              );
            })}
          </div>
          {qty > 1 && (
            <div className="flex items-center justify-between border-t pt-2 text-sm text-muted-foreground">
              <span>Subtotal{` (× ${qty} samples)`}</span>
              <span className="tabular-nums">{pkr(netTotal)}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2">
            <span className="text-sm">Services tax</span>
            {TAX_RATES.map((r) => (
              <label key={r} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="taxPct"
                  value={r}
                  checked={taxPct === r}
                  onChange={() => setTaxPct(r)}
                />
                {r === 0 ? "None" : `${r}%`}
              </label>
            ))}
            {taxPct > 0 && (
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                + {pkr(taxAmount)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="font-medium">Total</span>
            <span className="font-semibold tabular-nums">{pkr(total)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing selected yet — tick packages or parameters above.
        </p>
      )}

      {/* What actually submits: the selected ids (the checkboxes are UI only, so
          a selection isn't lost when the matrix filter changes). */}
      {selectedPackages.map((p) => (
        <input key={`hp-${p.id}`} type="hidden" name="packageIds" value={p.id} />
      ))}
      {selectedParams.map((p) => (
        <input key={`hpar-${p.id}`} type="hidden" name="parameterIds" value={p.id} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="validUntil">Valid until</Label>
          <DateInput id="validUntil" name="validUntil" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create quotation"}
        </Button>
      </div>
    </form>

    {/* Rendered outside the quotation <form> — a nested form is invalid HTML. */}
    {addingClient && (
      <Modal title="New client" onClose={() => setAddingClient(false)}>
        {/* Stays open on success to show the one-time portal password; refresh
            pulls the new client into the dropdown above so it's selectable. */}
        <NewClientForm onCreated={() => router.refresh()} />
      </Modal>
    )}
    {addingParameter && (
      <Modal title="New parameter" onClose={() => setAddingParameter(false)}>
        <p className="text-xs text-muted-foreground">
          A parameter must be approved by the COO before it can be quoted. One you
          create as COO/admin is usable immediately; otherwise it stays pending.
        </p>
        <ParameterForm
          matrices={matrices}
          units={units}
          onDone={() => {
            router.refresh(); // pull the new parameter into the list above
            setAddingParameter(false);
          }}
        />
      </Modal>
    )}
    </>
  );
}

/**
 * Compact client-registration form for the inline "New client" popup. Reuses
 * the same server action as the full page; on success it surfaces the one-time
 * portal credentials and hands control back so the caller can refresh.
 */
function NewClientForm({ onCreated }: { onCreated: () => void }) {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClient,
    {},
  );
  const [sector, setSector] = useState("");
  const refreshed = useRef(false);

  // Refresh the parent's client list once, as soon as the client is created —
  // the popup itself stays open so the one-time credentials are still readable.
  useEffect(() => {
    if (state.ok && !refreshed.current) {
      refreshed.current = true;
      onCreated();
    }
  }, [state.ok, onCreated]);

  if (state.ok && state.tempPassword) {
    return (
      <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-3">
        <p className="font-medium text-green-800">Client registered ✓</p>
        <p className="text-sm text-green-900">
          A portal login was created. Share these one-time credentials — the password
          is shown only now. The client is now selectable above.
        </p>
        <div className="rounded-md border bg-white p-2 font-mono text-xs">
          <div>Email: {state.loginEmail}</div>
          <div>Temporary password: {state.tempPassword}</div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="nc-company">Company</Label>
        <Input id="nc-company" name="company" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nc-email">Email (client login)</Label>
          <Input id="nc-email" name="email" type="email" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nc-sector">Sector</Label>
          <select
            id="nc-sector"
            name="sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Select…</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
          {sector === "Other" && <Input name="sectorOther" placeholder="Specify sector" />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nc-contactPerson">Contact person</Label>
          <Input id="nc-contactPerson" name="contactPerson" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nc-contactNumber">Contact number</Label>
          <Input id="nc-contactNumber" name="contactNumber" />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register client"}
        </Button>
      </div>
    </form>
  );
}
