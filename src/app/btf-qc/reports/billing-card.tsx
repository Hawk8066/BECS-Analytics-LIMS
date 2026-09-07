import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateMonthlyQcInvoiceNow,
  setProductBillingParameter,
  setQcBillingClient,
} from "@/lib/actions/qc-billing";
import type { MonthlyQcPreview } from "@/lib/finance/qc-invoice";
import { monthLabel } from "@/lib/finance/qc-invoice";

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

export type ProductRate = {
  id: string;
  name: string;
  testParameter: string;
  parameter: { id: string; name: string; matrix: string | null; price: number | null } | null;
};

export type ParameterOption = {
  id: string;
  name: string;
  matrix: string | null;
  price: number | null;
};

export type ClientOption = { id: string; clientNo: string; company: string };

/**
 * Month-end billing for production QC: what the month owes, the invoice once it
 * exists, and the product-to-parameter links the prices come from.
 *
 * The invoice is raised automatically the first time anyone opens this page (or
 * Finance › Invoices) after the month closes; the button only exists so it can
 * be done sooner, and to make the automatic behaviour visible rather than
 * mysterious.
 */
export function BillingCard({
  preview,
  month,
  year,
  month0,
  canIssue,
  canPrice,
  products,
  parameters,
  facilityId,
  clients,
}: {
  preview: MonthlyQcPreview;
  month: string; // "2026-06"
  year: number;
  month0: number;
  canIssue: boolean;
  canPrice: boolean;
  products: ProductRate[];
  parameters: ParameterOption[];
  facilityId: string;
  clients: ClientOption[];
}) {
  const { invoice, billable, amount, skipped, monthClosed, billingClient } = preview;
  const unlinked = products.filter((p) => !p.parameter);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Billing — {monthLabel(year, month0)}
        </CardTitle>
        {invoice ? (
          <Link
            href={`/app/finance/invoices/${invoice.id}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            View {invoice.invoiceNo}
          </Link>
        ) : (
          canIssue &&
          monthClosed &&
          !!preview.billingClient &&
          billable.length > 0 && (
            <form action={generateMonthlyQcInvoiceNow}>
              <input type="hidden" name="month" value={month} />
              <button className={buttonVariants({ size: "sm" })}>
                Generate invoice
              </button>
            </form>
          )
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Nothing can be invoiced until the consolidating client is chosen. */}
        {!billingClient ? (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">No billing client set</p>
            <p className="mt-1 text-muted-foreground">
              Production-QC testing is consolidated onto one client each month.
              Pick that client to start invoicing — nothing is billed until then,
              and no approved lot is lost in the meantime.
            </p>
            {canIssue && (
              <form action={setQcBillingClient} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="facilityId" value={facilityId} />
                <select
                  name="clientId"
                  defaultValue=""
                  className="h-8 max-w-sm rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">— choose a client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.clientNo} · {c.company}
                    </option>
                  ))}
                </select>
                <button className={buttonVariants({ size: "sm" })}>Save</button>
              </form>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Billed to <span className="font-medium">{billingClient.company}</span>
          </p>
        )}

        {invoice ? (
          <p className="text-sm">
            <Badge>Invoiced</Badge>{" "}
            <span className="font-mono text-xs">{invoice.invoiceNo}</span> —{" "}
            {pkr(invoice.amount)} across {invoice.lots} lot
            {invoice.lots === 1 ? "" : "s"}.
          </p>
        ) : billable.length > 0 ? (
          <p className="text-sm">
            <span className="font-semibold">{pkr(amount)}</span> across{" "}
            {billable.length} approved lot{billable.length === 1 ? "" : "s"} is
            ready to invoice as{" "}
            <span className="font-mono text-xs">{preview.invoiceNo}</span>.{" "}
            {monthClosed ? (
              <span className="text-muted-foreground">
                Raised automatically on the next visit to this page or Finance ›
                Invoices.
              </span>
            ) : (
              <span className="text-muted-foreground">
                The month has not ended yet — it will be raised once it closes.
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing to bill: no approved lots are awaiting an invoice for this
            period.
          </p>
        )}

        {skipped.length > 0 && (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">Approved but not billable</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {skipped.map((s) => (
                <li key={`${s.product}-${s.reason}`}>
                  {s.product} — {s.lots} lot{s.lots === 1 ? "" : "s"}: {s.reason}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              These lots stay open and are billed on a later invoice once the
              product is linked to a priced parameter.
            </p>
          </div>
        )}

        {/* The product → parameter links every price on the invoice comes from. */}
        {(canPrice || unlinked.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Billing rates</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Test</th>
                    <th className="px-3 py-2 font-medium">Billed as (Parameters)</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t align-middle">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.testParameter}
                      </td>
                      <td className="px-3 py-2">
                        {canPrice ? (
                          <form
                            action={setProductBillingParameter}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="productTypeId"
                              value={p.id}
                            />
                            <select
                              name="parameterId"
                              defaultValue={p.parameter?.id ?? ""}
                              className="h-8 max-w-xs rounded-md border bg-transparent px-2 text-sm"
                            >
                              <option value="">— not linked —</option>
                              {parameters.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                  {o.matrix ? ` · ${o.matrix}` : ""}
                                  {o.price != null ? ` · ${pkr(o.price)}` : " · no price"}
                                </option>
                              ))}
                            </select>
                            <button
                              className={buttonVariants({
                                size: "sm",
                                variant: "outline",
                              })}
                            >
                              Save
                            </button>
                          </form>
                        ) : p.parameter ? (
                          <>
                            {p.parameter.name}
                            {p.parameter.matrix && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {p.parameter.matrix}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">not linked</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.parameter?.price != null ? (
                          pkr(p.parameter.price)
                        ) : (
                          <Badge variant="outline">unpriced</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Rates are held in Parameters, not here — changing a price there
              changes what future lots are billed at. Lots already invoiced keep
              the rate they were billed at.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
