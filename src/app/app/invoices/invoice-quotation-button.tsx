"use client";

import { useState } from "react";
import { issueInvoiceForQuotation } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface QuoteLine {
  id: string;
  kind: string;
  name: string;
  /** Quoted net (after any quotation/line discount) × sample quantity. */
  price: number;
}

export interface BillableQuote {
  id: string;
  quoteNo: string;
  clientLabel: string;
  subtotal: number;
  discountKind: string;
  discountValue: number;
  taxPct: number;
  total: number;
  items: QuoteLine[];
}

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

/** Services sales-tax rates (whole percent; 0 = none). */
const TAX_RATES = [0, 5, 15, 16] as const;

/**
 * "Invoice" a quotation via a popup. Prices already carry the discounts agreed
 * on the quotation, so there is nothing to discount again here — you only choose
 * the services tax, then confirm. This posts to the ledger.
 */
export function InvoiceQuotationButton({ quote }: { quote: BillableQuote }) {
  const [open, setOpen] = useState(false);
  // Tax defaults to what the quote carried, but can be set at invoice time.
  const [taxPct, setTaxPct] = useState(
    (TAX_RATES as readonly number[]).includes(quote.taxPct) ? quote.taxPct : 0,
  );

  const net = quote.items.reduce((s, it) => s + it.price, 0);
  const tax = Math.round((net * taxPct) / 100);
  const amount = net + tax;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Invoice
      </Button>
      {open && (
        <Modal
          title={`Invoice ${quote.quoteNo}`}
          onClose={() => setOpen(false)}
          className="max-w-2xl"
        >
          <form action={issueInvoiceForQuotation} className="space-y-4">
            <input type="hidden" name="quotationId" value={quote.id} />
            <p className="text-sm text-muted-foreground">
              Billing <span className="font-medium text-foreground">{quote.clientLabel}</span>.
              Prices are as quoted (discounts already applied). Choose the services tax;
              this posts to the ledger.
            </p>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {it.kind === "PACKAGE" ? "Package" : "Parameter"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{pkr(it.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{pkr(net)}</span>
              </div>
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
                    + {pkr(tax)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="font-medium">Total to invoice</span>
                <span className="font-semibold tabular-nums">{pkr(amount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={amount <= 0}>
                Issue invoice · {pkr(amount)}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
