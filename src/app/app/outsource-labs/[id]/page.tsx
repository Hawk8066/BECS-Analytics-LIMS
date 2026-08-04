import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canSetOutsourcePrice,
  canManageOutsourceBilling,
  canViewFinance,
} from "@/lib/auth/perms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutsourceLabPrices } from "./outsource-lab-prices";
import { RecordLabBillButton } from "./record-lab-bill-button";

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ISSUED: "secondary",
  PARTIAL: "outline",
  PAID: "default",
};

export default async function OutsourceLabHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  const canPrice = canSetOutsourcePrice(user.designation);
  const canBill = canManageOutsourceBilling(user.designation);
  if (!canPrice && !canBill && !canViewFinance(user.designation)) redirect("/app");

  const lab = await prisma.outsourceLab.findUnique({ where: { id } });
  if (!lab) notFound();

  const [priceRows, billable, bills, everOutsourced] = await Promise.all([
    prisma.outsourceLabPrice.findMany({
      where: { outsourceLabId: id },
      select: { parameterId: true, price: true },
    }),
    // Unbilled outsourced tests for this lab, in the viewer's facility (bills are
    // facility-scoped). Billable as soon as outsourced — result not required.
    prisma.sampleParameter.findMany({
      where: {
        outsourceLabId: id,
        outsourceBillId: null,
        sample: { facilityId: user.facilityId },
      },
      include: {
        parameter: { select: { name: true } },
        sample: { select: { labId: true, sampleType: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.outsourceBill.findMany({
      where: { outsourceLabId: id },
      orderBy: { createdAt: "desc" },
    }),
    // Every parameter ever outsourced to this lab (the exact rows to price — the
    // full parameter master would list same-name tests across many matrices).
    prisma.sampleParameter.findMany({
      where: { outsourceLabId: id },
      select: { parameterId: true },
      distinct: ["parameterId"],
    }),
  ]);

  const priceByParam = new Map(priceRows.map((p) => [p.parameterId, p.price]));
  // Price editor = parameters relevant to this lab: ever outsourced to it, or
  // already priced. Keyed by exact parameter id, so no matrix-duplicate confusion.
  const relevantIds = [
    ...new Set([
      ...everOutsourced.map((x) => x.parameterId),
      ...priceRows.map((p) => p.parameterId),
    ]),
  ];
  const parameters = relevantIds.length
    ? await prisma.parameter.findMany({
        where: { id: { in: relevantIds } },
        select: { id: true, name: true, matrix: true, unit: true },
        orderBy: { name: "asc" },
      })
    : [];
  const priceList = parameters.map((p) => ({ ...p, price: priceByParam.get(p.id) ?? null }));
  const billableTests = billable.map((sp) => ({
    id: sp.id,
    parameterName: sp.parameter.name,
    sampleLabId: sp.sample.labId,
    sampleType: sp.sample.sampleType,
    price: priceByParam.get(sp.parameterId) ?? null,
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/app/outsource-labs"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Outsource Labs
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{lab.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {lab.labNo}
          {lab.email ? ` · ${lab.email}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test prices</CardTitle>
        </CardHeader>
        <CardContent>
          <OutsourceLabPrices
            outsourceLabId={id}
            parameters={priceList}
            canManage={canPrice}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Billable tests ({billableTests.length})
          </CardTitle>
          {canBill && billableTests.length > 0 && (
            <RecordLabBillButton outsourceLabId={id} tests={billableTests} />
          )}
        </CardHeader>
        <CardContent>
          {billableTests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No unbilled outsourced tests for this lab.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab ID</TableHead>
                  <TableHead>Sample type</TableHead>
                  <TableHead>Parameter</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billableTests.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.sampleLabId}</TableCell>
                    <TableCell>{t.sampleType}</TableCell>
                    <TableCell>{t.parameterName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.price != null ? (
                        pkr(t.price)
                      ) : (
                        <span className="text-amber-700">set price</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill No</TableHead>
                  <TableHead>Lab invoice #</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/app/finance/outsource-bills/${b.id}`}
                        className="hover:underline"
                      >
                        {b.billNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.labInvoiceNo || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pkr(b.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"}>
                        {b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
