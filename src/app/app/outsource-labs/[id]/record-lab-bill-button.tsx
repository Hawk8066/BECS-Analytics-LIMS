"use client";

import { useMemo, useState } from "react";
import { createOutsourceBill } from "@/lib/actions/outsource-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

export interface BillableTest {
  id: string; // sampleParameterId
  parameterName: string;
  sampleLabId: string;
  sampleType: string;
  price: number | null; // paisa; null = no price set (not billable)
}

const pkr = (paisa: number) => `PKR ${(paisa / 100).toLocaleString("en-PK")}`;

/**
 * "Record lab invoice" popup: pick the lab's billable tests (priced from its
 * price list), capture the lab's invoice number + input tax, and post the bill.
 * The action redirects to the bill on success (closing this).
 */
export function RecordLabBillButton({
  outsourceLabId,
  tests,
}: {
  outsourceLabId: string;
  tests: BillableTest[];
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [taxPct, setTaxPct] = useState("0");
  const [netOverride, setNetOverride] = useState("");

  const priceableCount = tests.filter((t) => t.price != null).length;
  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const lineTotal = useMemo(
    () => tests.filter((t) => checked.has(t.id)).reduce((s, t) => s + (t.price ?? 0), 0),
    [tests, checked],
  );
  const net = netOverride.trim() ? Math.round((parseFloat(netOverride) || 0) * 100) : lineTotal;
  const tax = Math.round((net * (parseInt(taxPct, 10) || 0)) / 100);
  const gross = net + tax;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={priceableCount === 0}>
        Record lab invoice
      </Button>
      {open && (
        <Modal
          title="Record lab invoice"
          onClose={() => setOpen(false)}
          className="max-w-2xl"
        >
          <form action={createOutsourceBill} className="grid gap-4">
            <input type="hidden" name="outsourceLabId" value={outsourceLabId} />
            {[...checked].map((id) => (
              <input key={id} type="hidden" name="sampleParameterId" value={id} />
            ))}

            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
              {tests.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-2 ${t.price == null ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(t.id)}
                    disabled={t.price == null}
                    onChange={() => toggle(t.id)}
                    className="size-4"
                  />
                  <span className="font-mono text-xs">{t.sampleLabId}</span>
                  <span className="text-muted-foreground">{t.sampleType}</span>
                  <span>{t.parameterName}</span>
                  <span className="ml-auto tabular-nums">
                    {t.price != null ? (
                      pkr(t.price)
                    ) : (
                      <span className="text-amber-700">no price set</span>
                    )}
                  </span>
                </label>
              ))}
              {tests.length === 0 && (
                <p className="text-muted-foreground">No billable tests for this lab.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="labInvoiceNo">Lab invoice #</Label>
                <Input id="labInvoiceNo" name="labInvoiceNo" placeholder="the lab's invoice no." />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bill-tax">Input tax (%)</Label>
                <Input
                  id="bill-tax"
                  name="taxPct"
                  type="number"
                  min="0"
                  max="100"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5 sm:max-w-xs">
              <Label htmlFor="bill-net">Net total (PKR)</Label>
              <Input
                id="bill-net"
                name="netTotal"
                type="number"
                min="0"
                step="0.01"
                value={netOverride}
                onChange={(e) => setNetOverride(e.target.value)}
                placeholder={(lineTotal / 100).toString()}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the selected tests’ total; adjust to the lab’s actual net.
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Net {pkr(net)} · Tax {pkr(tax)}
              </span>
              <span className="font-semibold">Total {pkr(gross)}</span>
            </div>
            <div>
              <Button type="submit" disabled={checked.size === 0 || gross <= 0}>
                Record bill
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
