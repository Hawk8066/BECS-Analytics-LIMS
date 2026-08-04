import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canViewFinance, canManageOutsourceBilling } from "@/lib/auth/perms";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ISSUED: "secondary",
  PARTIAL: "outline",
  PAID: "default",
};

const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

export default async function OutsourceBillsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canViewFinance(user.designation) && !canManageOutsourceBilling(user.designation))
    redirect("/app");

  const sampleScope = user.canReadCrossSection
    ? {}
    : { sample: { facilityId: user.facilityId } };
  const [bills, pendingGroups] = await Promise.all([
    prisma.outsourceBill.findMany({
      where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
      include: { outsourceLab: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Outsourced tests not yet on any bill, grouped by lab — the payables queue.
    prisma.sampleParameter.groupBy({
      by: ["outsourceLabId"],
      where: { outsourceLabId: { not: null }, outsourceBillId: null, ...sampleScope },
      _count: { _all: true },
    }),
  ]);

  const pendingLabIds = pendingGroups
    .map((g) => g.outsourceLabId)
    .filter((x): x is string => !!x);
  const pendingLabs = pendingLabIds.length
    ? await prisma.outsourceLab.findMany({
        where: { id: { in: pendingLabIds } },
        select: { id: true, name: true },
      })
    : [];
  const labName = new Map(pendingLabs.map((l) => [l.id, l.name]));
  const pending = pendingGroups
    .filter((g) => g.outsourceLabId)
    .map((g) => ({
      id: g.outsourceLabId as string,
      name: labName.get(g.outsourceLabId as string) ?? "—",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payables — Outsource Bills</h1>
        <p className="text-sm text-muted-foreground">
          What we owe external labs for subcontracted tests.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-4">
          <p className="text-sm font-medium">Outsourced tests awaiting billing</p>
          <p className="text-xs text-muted-foreground">
            Set the lab’s prices and record its invoice from the lab’s page.
          </p>
          <div className="divide-y">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {p.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.count} test{p.count === 1 ? "" : "s"}
                  </span>
                </span>
                <Link
                  href={`/app/outsource-labs/${p.id}`}
                  className="font-medium text-primary underline"
                >
                  Set prices &amp; record bill →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No</TableHead>
              <TableHead>Lab</TableHead>
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
                <TableCell>{b.outsourceLab.name}</TableCell>
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
            {bills.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No outsource bills yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
