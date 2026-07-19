import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  BOOKED: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default async function ProductionDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [products, lots, recent] = await Promise.all([
    prisma.productType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qcLot.findMany({
      select: {
        id: true,
        status: true,
        verdict: true,
        assignedToId: true,
        productTypeId: true,
        createdAt: true,
      },
    }),
    prisma.qcLot.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        productType: { select: { name: true, unit: true } },
        assignedTo: { select: { email: true, profile: { select: { fullName: true } } } },
      },
    }),
  ]);

  const awaitingAssign = lots.filter((l) => l.status === "BOOKED" && !l.assignedToId).length;
  const awaitingResult = lots.filter((l) => l.status === "BOOKED" && l.assignedToId).length;
  const awaitingReview = lots.filter((l) => l.status === "SUBMITTED").length;
  const approvedThisMonth = lots.filter(
    (l) => l.status === "APPROVED" && l.createdAt >= monthStart,
  ).length;
  const judged = lots.filter((l) => l.verdict === "PASS" || l.verdict === "FAIL");
  const passRate = judged.length
    ? Math.round((judged.filter((l) => l.verdict === "PASS").length / judged.length) * 100)
    : null;

  const perProduct = products.map((p) => {
    const rows = lots.filter((l) => l.productTypeId === p.id);
    return {
      name: p.name,
      total: rows.length,
      pending: rows.filter((l) => l.status === "BOOKED" || l.status === "SUBMITTED").length,
      pass: rows.filter((l) => l.verdict === "PASS").length,
      fail: rows.filter((l) => l.verdict === "FAIL").length,
    };
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/production" className="underline">
              Production QC
            </Link>{" "}
            / Dashboard
          </p>
          <h1 className="text-2xl font-semibold">Production QC Dashboard</h1>
        </div>
        <Link
          href="/app/production/reports"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Monthly reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Awaiting assignment" value={awaitingAssign} hint="Booked, no analyst" />
        <StatCard label="Awaiting result" value={awaitingResult} hint="Assigned to analyst" />
        <StatCard label="Awaiting review" value={awaitingReview} hint="Result submitted" />
        <StatCard label="Approved this month" value={approvedThisMonth} />
        <StatCard label="Total lots" value={lots.length} />
        <StatCard
          label="Pass rate"
          value={passRate == null ? "—" : `${passRate}%`}
          hint={`${judged.length} judged`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By product</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Lots</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Pass</TableHead>
                <TableHead className="text-right">Fail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perProduct.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.total}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.pending}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-green-700">
                    {p.pass}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">
                    {p.fail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Recent lots</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Analyst</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/app/production/${l.id}`} className="underline">
                      {l.lotNo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.productType.name}</TableCell>
                  <TableCell className="font-medium">{l.refNo}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.assignedTo?.profile?.fullName ?? l.assignedTo?.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {l.resultValue != null ? `${l.resultValue} ${l.productType.unit}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(l.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No lots yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
