import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canViewFinance } from "@/lib/auth/perms";
import { getFinanceSummary } from "@/lib/finance/summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile, TileRow } from "@/components/finance/stat-tile";
import { Money, SectionLabel, Row } from "@/components/finance/money";

export default async function StatementsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canViewFinance(user.designation)) redirect("/app");

  const s = await getFinanceSummary();
  const e = s.expenses.byGroup;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financial Statements</h1>
        <p className="text-sm text-muted-foreground">
          Computed live from the general ledger (ADR-0004). Company-wide, in PKR.
        </p>
      </div>

      <TileRow>
        <StatTile label="Income from tests" value={s.income.net} tone="#0f6f6a" />
        <StatTile label="Total expenses" value={s.expenses.total} tone="#a8481c" />
        <StatTile
          label="Net income"
          value={s.netIncome}
          tone={s.netIncome < 0 ? "#a8481c" : "#3d7a20"}
        />
        <StatTile
          label="Payable to vendors"
          value={s.vendors.outstanding}
          tone="#0a6ea0"
        />
        <StatTile
          label="Payable to external labs"
          value={s.labs.outstanding}
          tone="#2f6f9f"
        />
      </TileRow>

      {/* 1 — Income from the tests ------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Income from tests</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionLabel>Billed to clients</SectionLabel>
          <Row label="Net testing revenue" value={s.income.net} />
          <Row label="Sales tax charged (owed to FBR)" value={s.income.tax} />
          <Row label="Total invoiced (tax-inclusive)" value={s.income.invoiced} bold />

          <SectionLabel className="mt-3">Collection</SectionLabel>
          <Row label="Received from clients" value={s.income.received} />
          <div className="mt-2 border-t pt-2">
            <Row
              label="Still receivable from clients"
              value={s.income.outstanding}
              bold
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {s.income.records.count} invoice
            {s.income.records.count === 1 ? "" : "s"} on record ·{" "}
            <Link href="/app/finance/invoices" className="underline">
              View invoices
            </Link>
          </p>
          {/* The ledger is append-only: deleting an invoice leaves its posting
              behind, so say so rather than showing two revenue figures. */}
          {s.income.records.total !== s.income.invoiced && (
            <p className="mt-1 text-xs text-amber-700">
              Figures come from the ledger. The invoices still on record total{" "}
              <Money value={s.income.records.total} /> — a difference of{" "}
              <Money value={s.income.invoiced - s.income.records.total} />, which
              means invoices were deleted after being posted.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2 — Amount payable to vendors -------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Amount payable to vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {s.vendors.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vendor bills recorded yet.{" "}
              <Link href="/app/finance/vendor-bills" className="underline">
                Record a vendor bill
              </Link>{" "}
              to start tracking what the lab owes suppliers.
            </p>
          ) : (
            <>
              {s.vendors.rows.map((v) => (
                <Row
                  key={v.id}
                  label={v.name}
                  value={v.outstanding}
                  hint={
                    v.outstanding > 0
                      ? `${v.openBills} open bill${v.openBills === 1 ? "" : "s"}`
                      : "settled"
                  }
                />
              ))}
              <div className="mt-2 border-t pt-2">
                <Row label="Total payable to vendors" value={s.vendors.outstanding} bold />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <Money value={s.vendors.billed} /> billed ·{" "}
                <Money value={s.vendors.paid} /> paid ·{" "}
                <Link href="/app/finance/vendor-bills" className="underline">
                  View vendor bills
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3 — Total expenses -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Total expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label="Vendor purchases"
            value={e.vendorPurchases}
            hint="goods & supplies billed by vendors"
          />
          <Row
            label="Utilities & other payments"
            value={e.utilitiesOther}
            hint="electricity, rent, transport, upkeep"
          />
          <Row
            label="External labs"
            value={e.externalLabs}
            hint="subcontracted testing"
          />
          <Row label="Payroll" value={e.payroll} hint="salaries & allowances" />
          <div className="mt-2 border-t pt-2">
            <Row label="Total expenses" value={s.expenses.total} bold />
          </div>
          <div className="mt-3 border-t pt-2">
            <Row
              label="Net income (testing revenue less expenses)"
              value={s.netIncome}
              bold
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Vendor purchases and utilities are recorded on the{" "}
            <Link href="/app/finance/vendor-bills" className="underline">
              vendor bills
            </Link>{" "}
            and{" "}
            <Link href="/app/finance/expenses" className="underline">
              expenses
            </Link>{" "}
            pages.
          </p>
        </CardContent>
      </Card>

      {/* 4 — Amount payable to external labs --------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            4. Amount payable to external labs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {s.labs.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outsource-lab bills recorded yet.
            </p>
          ) : (
            <>
              {s.labs.rows.map((l) => (
                <Row
                  key={l.id}
                  label={l.name}
                  value={l.outstanding}
                  hint={
                    l.outstanding > 0
                      ? `${l.openBills} open bill${l.openBills === 1 ? "" : "s"}`
                      : "settled"
                  }
                />
              ))}
              <div className="mt-2 border-t pt-2">
                <Row
                  label="Total payable to external labs"
                  value={s.labs.outstanding}
                  bold
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <Money value={s.labs.billed} /> billed ·{" "}
                <Money value={s.labs.paid} /> paid ·{" "}
                <Link href="/app/finance/outsource-bills" className="underline">
                  View outsource bills
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
