"use client";

import { useActionState, useMemo, useState } from "react";
import { registerSample, type FormState } from "@/lib/actions/samples";
import { ThirdPartyQuickAdd } from "./third-party-quick-add";
import { priceAt, type PriceEntry, type PricePriority } from "@/lib/pricing";
import { UNITS } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ParamOpt {
  id: string;
  name: string;
  unit: string | null;
  matrix: string | null;
  accredited: boolean;
  price: PriceEntry; // { normal, urgent } — one price per parameter
}
interface PackageOpt {
  id: string;
  name: string;
  matrix: string | null;
  parameterIds: string[];
  price: PriceEntry;
}
export interface QuotationItem {
  kind: "PARAMETER" | "PACKAGE";
  refId: string | null;
  name: string;
  /** Price as quoted (paisa) — honoured over the current price. */
  price: number;
}
export interface QuotationOpt {
  id: string;
  quoteNo: string;
  clientId: string;
  clientLabel: string;
  sector: string | null;
  priority: PricePriority;
  /** Net agreed total (after any quote-level discount). */
  total: number;
  /** What is being tested, as recorded on the quote. */
  sampleType: string | null;
  /** Samples the quote is for, and how many are already booked against it. */
  sampleQty: number;
  booked: number;
  items: QuotationItem[];
}
export interface StandardOpt {
  id: string;
  name: string;
  matrix: string | null;
  /** parameterId → its acceptance limit, snapshotted onto the sample at booking. */
  limits: { parameterId: string; min: number | null; max: number | null }[];
}

function pkr(paisa: number | undefined): string {
  return paisa != null ? `PKR ${(paisa / 100).toLocaleString("en-PK")}` : "—";
}

/** Stable key for a quoted line (a quote can list a parameter and a package). */
const itemKey = (it: QuotationItem) => `${it.kind}:${it.refId}`;

export function SampleForm({
  labs,
  defaultLabId,
  matrices,
  clients,
  parameters,
  packages,
  quotations,
  standards,
  thirdParties,
  defaultQuotationId,
}: {
  labs: { id: string; name: string }[];
  defaultLabId?: string;
  matrices: string[];
  clients: { id: string; label: string; sector: string | null }[];
  parameters: ParamOpt[];
  packages: PackageOpt[];
  /** Accepted quotations this sample may be booked against. */
  quotations: QuotationOpt[];
  /** Conformity standards the sample can be booked against (on request). */
  standards: StandardOpt[];
  /** Third parties the report may be issued in the name of. */
  thirdParties: { id: string; label: string }[];
  defaultQuotationId?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerSample,
    {},
  );

  // Arriving from "Register sample" on an accepted quote pre-selects it, so the
  // client, sector and tests are already those that were agreed.
  const initialQuote = quotations.find((q) => q.id === defaultQuotationId) ?? null;
  const [quotationId, setQuotationId] = useState(initialQuote?.id ?? "");
  // Sector filters the client list; picking one narrows which clients show.
  const [sector, setSector] = useState(initialQuote?.sector ?? "");
  const [clientId, setClientId] = useState(initialQuote?.clientId ?? "");
  // Quoted lines start ticked; untick one the client didn't actually send.
  const [quotedLines, setQuotedLines] = useState<Set<string>>(
    new Set(initialQuote?.items.map(itemKey) ?? []),
  );
  // The sample's own priority picks the rate card: urgent work is charged the
  // urgent rate where one is set.
  const [priority, setPriority] = useState<PricePriority>(initialQuote?.priority ?? "NORMAL");
  // Pre-filled from the quote's sample type; still editable per sample.
  const [sampleType, setSampleType] = useState(initialQuote?.sampleType ?? "");
  const [matrix, setMatrix] = useState("");
  // Optional conformity standard the client asked their sample to be judged against.
  const [standardId, setStandardId] = useState("");
  // Optional third party the report is issued in the name of; quick-add appends here.
  const [thirdPartyId, setThirdPartyId] = useState("");
  const [tpList, setTpList] = useState(thirdParties);
  const [paramQuery, setParamQuery] = useState("");
  const [params, setParams] = useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = useState<Set<string>>(new Set());
  // Per-row discount (rupees) on the additional (non-quoted) tests.
  const [extraDiscounts, setExtraDiscounts] = useState<Record<string, string>>({});
  // How many samples to register — a quote may be for several.
  const remainingOf = (q: QuotationOpt | null) =>
    q ? Math.max(0, q.sampleQty - q.booked) : 0;
  const [sampleCount, setSampleCount] = useState(
    initialQuote ? Math.max(1, remainingOf(initialQuote)) : 1,
  );

  const quotation = quotations.find((q) => q.id === quotationId) ?? null;
  const remaining = remainingOf(quotation);

  // Distinct sectors of the clients we can see; picking one filters the list.
  const sectorOptions = useMemo(
    () => [...new Set(clients.map((c) => c.sector).filter((s): s is string => !!s))].sort(),
    [clients],
  );
  const visibleClients = useMemo(
    () => (sector ? clients.filter((c) => c.sector === sector) : clients),
    [clients, sector],
  );

  function chooseQuotation(id: string) {
    const q = quotations.find((x) => x.id === id) ?? null;
    setQuotationId(id);
    setQuotedLines(new Set(q?.items.map(itemKey) ?? []));
    // A quote is for one client; adopt it rather than let the sample drift.
    if (q) {
      setSector(q.sector ?? ""); // narrow the client list to the quote's sector
      setClientId(q.clientId);
      setPriority(q.priority); // the quote was priced off one rate card
      setSampleType(q.sampleType ?? ""); // adopt what the quote was for
    }
    setSampleCount(q ? Math.max(1, remainingOf(q)) : 1);
    setParams(new Set());
    setPkgs(new Set());
  }

  /** Refs already covered by the ticked quoted lines, by kind. */
  const quoted = useMemo(() => {
    const parameterIds = new Set<string>();
    const packageIds = new Set<string>();
    for (const it of quotation?.items ?? []) {
      if (!it.refId || !quotedLines.has(itemKey(it))) continue;
      (it.kind === "PACKAGE" ? packageIds : parameterIds).add(it.refId);
    }
    return { parameterIds, packageIds };
  }, [quotation, quotedLines]);

  // Packages are filed under a matrix — show only the selected matrix's.
  const matrixPackages = useMemo(
    () =>
      matrix
        ? packages.filter((p) => p.matrix === matrix && priceAt(p.price, priority) != null)
        : [],
    [matrix, packages, priority],
  );

  // Parameters already covered by a selected package (quoted or added) — don't
  // list them again on their own.
  const coveredParamIds = useMemo(() => {
    const s = new Set(quoted.parameterIds);
    for (const id of pkgs)
      packages.find((p) => p.id === id)?.parameterIds.forEach((pid) => s.add(pid));
    return s;
  }, [quoted, pkgs, packages]);

  // The parameter list is filtered by the chosen matrix (there are many), less
  // any covered by a package, then by the search box.
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

  /**
   * What will actually be registered. The visible checkboxes are only UI: the
   * parameter list is filtered to one matrix at a time, so a row picked under
   * one matrix unmounts when another is chosen — and an unmounted checkbox
   * submits nothing. These sets are submitted as hidden fields instead, which
   * is what lets a sample carry tests from several matrices at once.
   */
  const selected = useMemo(() => {
    const parameterIds = new Set([...quoted.parameterIds, ...params]);
    const packageIds = new Set([...quoted.packageIds, ...pkgs]);
    return { parameterIds, packageIds };
  }, [quoted, params, pkgs]);

  /** Tests picked on top of the quotation (or all of them, walk-in). */
  const extras = useMemo(
    () => ({
      parameters: [...params]
        .filter((id) => !coveredParamIds.has(id))
        .map((id) => parameters.find((p) => p.id === id))
        .filter((p): p is ParamOpt => !!p),
      packages: [...pkgs]
        .filter((id) => !quoted.packageIds.has(id))
        .map((id) => packages.find((p) => p.id === id))
        .filter((p): p is PackageOpt => !!p),
    }),
    [params, pkgs, quoted, coveredParamIds, parameters, packages],
  );

  // A discount can be given on each added-on test, keyed by "KIND:id" (rupees).
  const extraKey = (kind: "PACKAGE" | "PARAMETER", id: string) => `${kind}:${id}`;
  const extraDisc = (k: string, price: number) => {
    const v = Number(extraDiscounts[k]);
    return Number.isFinite(v) && v > 0 ? Math.min(price, Math.round(v * 100)) : 0;
  };
  const extrasTotal = useMemo(() => {
    let t = 0;
    for (const p of extras.parameters) {
      const price = priceAt(p.price, priority) ?? 0;
      t += price - extraDisc(extraKey("PARAMETER", p.id), price);
    }
    for (const pk of extras.packages) {
      const price = priceAt(pk.price, priority) ?? 0;
      t += price - extraDisc(extraKey("PACKAGE", pk.id), price);
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras, priority, extraDiscounts]);

  const quotedTotal = useMemo(
    () =>
      (quotation?.items ?? []).reduce(
        (s, it) => (quotedLines.has(itemKey(it)) ? s + it.price : s),
        0,
      ),
    [quotation, quotedLines],
  );

  // Quoted lines keep the price that was quoted; anything added on top is
  // priced from today's sector list.
  const total = quotedTotal + extrasTotal;

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="facilityId">Lab</Label>
        <select
          id="facilityId"
          name="facilityId"
          required
          defaultValue={defaultLabId ?? ""}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {quotations.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="quotationId">Accepted quotation (optional)</Label>
          <select
            id="quotationId"
            name="quotationId"
            value={quotationId}
            onChange={(e) => chooseQuotation(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">No quotation — walk-in sample</option>
            {quotations.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quoteNo} · {q.clientLabel}
                {q.sector ? ` · ${q.sector}` : ""} · {pkr(q.total)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Booking against a quotation fills in the client, sector and agreed tests,
            and keeps the prices that were quoted.
          </p>
        </div>
      )}

      {quotation && quotation.sampleQty > 1 && (
        <div className="grid gap-1.5 rounded-md border bg-muted/30 p-3">
          <Label htmlFor="sampleCount">Samples to register</Label>
          <input
            id="sampleCount"
            name="sampleCount"
            type="number"
            min="1"
            max={Math.max(1, remaining)}
            step="1"
            value={sampleCount}
            onChange={(e) =>
              setSampleCount(
                Math.max(1, Math.min(Math.max(1, remaining), Math.floor(Number(e.target.value) || 1))),
              )
            }
            disabled={remaining === 0}
            className="h-9 w-28 rounded-md border bg-transparent px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This quote is for {quotation.sampleQty} samples · {quotation.booked} already
            registered ·{" "}
            {remaining === 0 ? "none remaining" : `${remaining} remaining`}. Each is
            registered as its own sample with the same tests.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="sector">Sector</Label>
        <select
          id="sector"
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setClientId(""); // the client list changes; re-pick
          }}
          disabled={!!quotation}
          className="h-9 rounded-md border bg-transparent px-3 text-sm disabled:opacity-70"
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
        <Label htmlFor="clientId">Client</Label>
        <select
          id="clientId"
          name="clientId"
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={!!quotation}
          className="h-9 rounded-md border bg-transparent px-3 text-sm disabled:opacity-70"
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
        {quotation && (
          // A disabled select submits nothing, and the client must match the quote.
          <input type="hidden" name="clientId" value={clientId} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sampleType">Sample type</Label>
          <Input
            id="sampleType"
            name="sampleType"
            placeholder="e.g. Zabardast Urea"
            required
            value={sampleType}
            onChange={(e) => setSampleType(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="clientSampleRef">Client Sample ID</Label>
          <Input id="clientSampleRef" name="clientSampleRef" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="quantity">Quantity received</Label>
          <Input id="quantity" name="quantity" placeholder="e.g. 800 g" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="physicalCondition">Physical condition</Label>
          <Input
            id="physicalCondition"
            name="physicalCondition"
            placeholder="e.g. Solid granules"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
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
          <Label htmlFor="thirdPartyId">Third party (optional)</Label>
          <div className="flex gap-2">
            <select
              id="thirdPartyId"
              name="thirdPartyId"
              value={thirdPartyId}
              onChange={(e) => setThirdPartyId(e.target.value)}
              className="h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">— none (report in client&apos;s name) —</option>
              {tpList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ThirdPartyQuickAdd
              onCreated={(id, label) => {
                setTpList((prev) =>
                  prev.some((x) => x.id === id) ? prev : [...prev, { id, label }],
                );
                setThirdPartyId(id);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            If set, the report is issued in this third party&apos;s name and
            address.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="instructions">Client instructions</Label>
        <Textarea id="instructions" name="instructions" />
      </div>

      {standards.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="standardId">Conformity standard (optional)</Label>
          <select
            id="standardId"
            name="standardId"
            value={standardId}
            onChange={(e) => setStandardId(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">No conformity — report values only</option>
            {standards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.matrix ? ` · ${s.matrix}` : ""} ({s.limits.length} limit
                {s.limits.length === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            On customer request — each result with a limit in this standard is marked
            conforming or non-conforming on the report.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="matrix">Matrix (filters parameters)</Label>
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
      <p className="-mt-2 text-xs text-muted-foreground">
        Matrix narrows the parameter list; the Priority above picks the rate card.
      </p>

      {quotation && (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">
            Quoted tests ({quotation.quoteNo})
          </legend>
          <p className="text-xs text-muted-foreground">
            Ticked lines are registered at the quoted price. Untick anything the client
            did not send with this sample.
          </p>
          {quotation.items.map((it) => {
            const key = itemKey(it);
            const checked = quotedLines.has(key);
            return (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!it.refId}
                  onChange={() => setQuotedLines((s) => toggle(s, key))}
                />
                <span>{it.name}</span>
                {it.kind === "PACKAGE" && (
                  <span className="text-xs text-muted-foreground">(package)</span>
                )}
                <span className="ml-auto">{pkr(it.price)}</span>
              </label>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Quoted total {pkr(quotation.total)} · anything you add below is priced
            from the current price list.
          </p>
        </fieldset>
      )}

      {matrix && matrixPackages.length > 0 && (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Packages ({matrix})</legend>
          {matrixPackages.map((pkg) => (
            <label key={pkg.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={quoted.packageIds.has(pkg.id) || pkgs.has(pkg.id)}
                disabled={quoted.packageIds.has(pkg.id)}
                onChange={() => setPkgs((s) => toggle(s, pkg.id))}
              />
              <span className="font-medium">{pkg.name}</span>
              {quoted.packageIds.has(pkg.id) && (
                <span className="rounded bg-muted px-1 text-xs text-muted-foreground">
                  in quotation
                </span>
              )}
              <span className="text-muted-foreground">
                ({pkg.parameterIds.length} params)
              </span>
              <span className="ml-auto">
                {pkr(priceAt(pkg.price, priority) ?? undefined)}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {quotation && (
        <p className="-mb-2 text-sm font-medium">
          Additional tests
          <span className="ml-2 font-normal text-muted-foreground">
            not on the quotation — pick any matrix below; they are charged at the
            current price
          </span>
        </p>
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
            {shownParams.map((p) => {
              const unitOptions =
                p.unit && !UNITS.includes(p.unit) ? [p.unit, ...UNITS] : UNITS;
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={params.has(p.id)}
                    onChange={() => setParams((s) => toggle(s, p.id))}
                  />
                  <span>{p.name}</span>
                  {p.accredited && (
                    <span className="rounded bg-[#eaf6e2] px-1 text-xs text-[#4e8a2c]">
                      accredited
                    </span>
                  )}
                  <select
                    name={`unit_${p.id}`}
                    defaultValue={p.unit ?? ""}
                    className="ml-auto h-7 rounded-md border bg-transparent px-1 text-xs"
                    aria-label={`Unit for ${p.name}`}
                  >
                    <option value="">unit…</option>
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <span className="w-24 text-right text-muted-foreground">
                    {pkr(priceAt(p.price, priority) ?? undefined)}
                  </span>
                </div>
              );
            })}
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
          Select a matrix to choose parameters.
        </p>
      )}

      {(extras.parameters.length > 0 || extras.packages.length > 0) && (
        <div className="grid gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">
            {quotation ? "Added on top of the quotation" : "Selected tests"} (
            {extras.parameters.length + extras.packages.length})
          </p>
          {/* Listed here because the parameter list above only shows one matrix
              at a time — this is the whole picture of what was added. Each takes
              its own discount. */}
          <div className="space-y-1.5">
            {[
              ...extras.packages.map((pk) => ({
                kind: "PACKAGE" as const,
                id: pk.id,
                name: `${pk.name} (package)`,
                price: priceAt(pk.price, priority) ?? 0,
                remove: () => setPkgs((s) => toggle(s, pk.id)),
              })),
              ...extras.parameters.map((p) => ({
                kind: "PARAMETER" as const,
                id: p.id,
                name: p.matrix ? `${p.name} · ${p.matrix}` : p.name,
                price: priceAt(p.price, priority) ?? 0,
                remove: () => setParams((s) => toggle(s, p.id)),
              })),
            ].map((row) => {
              const k = extraKey(row.kind, row.id);
              const disc = extraDisc(k, row.price);
              return (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{row.name}</span>
                  <span className="w-20 text-right tabular-nums text-muted-foreground">
                    {pkr(row.price)}
                  </span>
                  <span className="text-xs text-muted-foreground">−</span>
                  <input
                    type="number"
                    min="0"
                    max={row.price / 100}
                    step="0.01"
                    value={extraDiscounts[k] ?? ""}
                    onChange={(e) =>
                      setExtraDiscounts((d) => ({ ...d, [k]: e.target.value }))
                    }
                    placeholder="0"
                    aria-label={`Discount for ${row.name}`}
                    className="h-8 w-20 rounded-md border bg-transparent px-2 text-right text-sm"
                  />
                  <span className="w-20 text-right font-medium tabular-nums">
                    {pkr(row.price - disc)}
                  </span>
                  <button
                    type="button"
                    onClick={row.remove}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${row.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* What actually submits. The checkboxes above are display state: the
          parameter list is filtered to one matrix, so its inputs unmount when
          the matrix changes and would take the selection with them. */}
      {[...selected.parameterIds].map((id) => (
        <input key={`p-${id}`} type="hidden" name="parameterIds" value={id} />
      ))}
      {[...selected.packageIds].map((id) => (
        <input key={`k-${id}`} type="hidden" name="packageIds" value={id} />
      ))}
      {/* A parameter whose row isn't on screen has no unit picker, so carry its
          default unit through rather than registering the test without one. */}
      {[...selected.parameterIds]
        .filter((id) => !matrixParams.some((p) => p.id === id))
        .map((id) => {
          const unit = parameters.find((p) => p.id === id)?.unit;
          return unit ? (
            <input key={`u-${id}`} type="hidden" name={`unit_${id}`} value={unit} />
          ) : null;
        })}

      <div className="flex flex-col items-end gap-0.5 text-sm">
        {quotation && (
          <>
            <span className="text-muted-foreground">
              Quoted: <span className="text-foreground">{pkr(quotedTotal)}</span>
            </span>
            <span className="text-muted-foreground">
              Additional: <span className="text-foreground">{pkr(extrasTotal)}</span>
            </span>
          </>
        )}
        <span className="text-muted-foreground">
          {sampleCount > 1 ? "Per sample:" : "Estimated total:"}&nbsp;
          <span className="font-medium text-foreground">{pkr(total)}</span>
        </span>
        {sampleCount > 1 && (
          <span>
            <span className="text-muted-foreground">
              For {sampleCount} samples:&nbsp;
            </span>
            <span className="font-semibold">{pkr(total * sampleCount)}</span>
          </span>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {quotation && remaining === 0 && (
        <p className="text-sm text-amber-700">
          All {quotation.sampleQty} samples for this quotation are already registered.
        </p>
      )}
      <div>
        <Button
          type="submit"
          disabled={pending || (!!quotation && remaining === 0)}
        >
          {pending
            ? "Registering…"
            : sampleCount > 1
              ? `Register ${sampleCount} samples`
              : "Register sample"}
        </Button>
      </div>
    </form>
  );
}
