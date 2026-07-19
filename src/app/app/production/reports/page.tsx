import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ProductionReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const sp = await searchParams;
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(sp.month ?? "");
  const year = m ? parseInt(m[1], 10) : now.getFullYear();
  const month0 = m ? parseInt(m[2], 10) - 1 : now.getMonth();
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 1);
  const prev = ym(new Date(year, month0 - 1, 1));
  const next = ym(new Date(year, month0 + 1, 1));

  const [products, lots] = await Promise.all([
    prisma.productType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qcLot.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      include: {
        productType: { select: { id: true, name: true, unit: true, basis: true } },
        assignedTo: { select: { email: true, profile: { select: { fullName: true } } } },
      },
    }),
  ]);

  const total = lots.length;
  const passed = lots.filter((l) => l.verdict === "PASS").length;
  const failed = lots.filter((l) => l.verdict === "FAIL").length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/production" className="underline">
              Production QC
            </Link>{" "}
            / Monthly reports
          </p>
          <h1 className="text-2xl font-semibold">
            {MONTHS[month0]} {year}
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} lot{total === 1 ? "" : "s"} · {passed} pass · {failed} fail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/production/reports?month=${prev}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            ← Prev
          </Link>
          <form className="flex items-center gap-2">
            <input
              type="month"
              name="month"
              defaultValue={ym(start)}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
            />
            <button className={buttonVariants({ size: "sm", variant: "outline" })}>
              Go
            </button>
          </form>
          <Link
            href={`/app/production/reports?month=${next}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Next →
          </Link>
        </div>
      </div>

      {products.map((p) => {
        const rows = lots.filter((l) => l.productType.id === p.id);
        if (rows.length === 0) return null;
        return (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {p.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {rows.length} lot{rows.length === 1 ? "" : "s"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lab No</TableHead>
                      <TableHead>{p.basis === "VEHICLE" ? "Vehicle" : "Batch"}</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Analyst</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/app/production/${l.id}`} className="underline">
                            {l.lotNo}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{l.refNo}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(l.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {l.assignedTo?.profile?.fullName ?? l.assignedTo?.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          {l.resultValue != null ? (
                            <span className="flex items-center gap-1.5">
                              {l.resultValue} {l.productType.unit}
                              {l.verdict && (
                                <Badge variant={l.verdict === "PASS" ? "default" : "destructive"}>
                                  {l.verdict}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>
                            {l.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {total === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No lots booked in {MONTHS[month0]} {year}.
        </p>
      )}
    </div>
  );
}
