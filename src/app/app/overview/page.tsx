import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { canManageQuotations } from "@/lib/auth/perms";
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

function pkr(paisa: number): string {
  return "PKR " + Math.round(paisa / 100).toLocaleString("en-PK");
}

// Testing pipeline in the order a sample moves through the lab.
const SAMPLE_STAGES: { key: string; label: string; color: string }[] = [
  { key: "REGISTERED", label: "Registered", color: "bg-slate-400" },
  { key: "ASSIGNED", label: "Assigned", color: "bg-blue-400" },
  { key: "RESULTS_ENTERED", label: "Results in", color: "bg-indigo-400" },
  { key: "VERIFIED", label: "Verified", color: "bg-violet-400" },
  { key: "APPROVED", label: "Approved", color: "bg-emerald-400" },
  { key: "REPORTED", label: "Reported", color: "bg-emerald-600" },
];

const QUOTE_STAGES: {
  key: string;
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
}[] = [
  { key: "DRAFT", label: "Draft", variant: "outline" },
  { key: "SENT", label: "Sent", variant: "secondary" },
  { key: "ACCEPTED", label: "Accepted", variant: "default" },
  { key: "REJECTED", label: "Rejected", variant: "destructive" },
];

const SAMPLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  REGISTERED: "outline",
  ASSIGNED: "secondary",
  RESULTS_ENTERED: "secondary",
  VERIFIED: "secondary",
  APPROVED: "default",
  REPORTED: "default",
};

export default async function TestingOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  // Sample has facility+section; Client has only facility; Quotation scopes via
  // its client's facility. Cross-section roles (COO/OM) see everything.
  const sampleScope = readScope(user);
  const facilityScope = user.canReadCrossSection
    ? {}
    : { facilityId: user.facilityId };
  const quoteScope = user.canReadCrossSection
    ? {}
    : { client: { facilityId: user.facilityId } };

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [
    clientCount,
    newClients,
    sampleCount,
    sampleByStatus,
    quoteByStatus,
    wonValue,
    openValue,
    recentSamples,
    recentQuotes,
  ] = await Promise.all([
    prisma.client.count({ where: facilityScope }),
    prisma.client.count({ where: { ...facilityScope, createdAt: { gte: since30 } } }),
    prisma.sample.count({ where: sampleScope }),
    prisma.sample.groupBy({
      by: ["status"],
      where: sampleScope,
      _count: { _all: true },
    }),
    prisma.testQuotation.groupBy({
      by: ["status"],
      where: quoteScope,
      _count: { _all: true },
      _sum: { subtotal: true },
    }),
    prisma.testQuotation.aggregate({
      where: { ...quoteScope, status: "ACCEPTED" },
      _sum: { subtotal: true },
    }),
    prisma.testQuotation.aggregate({
      where: { ...quoteScope, status: { in: ["DRAFT", "SENT"] } },
      _sum: { subtotal: true },
    }),
    prisma.sample.findMany({
      where: sampleScope,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { client: { select: { company: true } } },
    }),
    prisma.testQuotation.findMany({
      where: quoteScope,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        client: { select: { company: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const sampleCounts: Record<string, number> = {};
  for (const r of sampleByStatus) sampleCounts[r.status] = r._count._all;
  const quoteCounts: Record<string, number> = {};
  const quoteSums: Record<string, number> = {};
  for (const r of quoteByStatus) {
    quoteCounts[r.status] = r._count._all;
    quoteSums[r.status] = r._sum.subtotal ?? 0;
  }
  const openQuotes = (quoteCounts.DRAFT ?? 0) + (quoteCounts.SENT ?? 0);
  const inProgressSamples =
    (sampleCounts.REGISTERED ?? 0) +
    (sampleCounts.ASSIGNED ?? 0) +
    (sampleCounts.RESULTS_ENTERED ?? 0) +
    (sampleCounts.VERIFIED ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Testing Overview</h1>
          <p className="text-sm text-muted-foreground">
            Clients, samples &amp; quotations
            {user.canReadCrossSection ? " · all sections" : " · your section"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/samples/new" className={buttonVariants({ size: "sm" })}>
            New sample
          </Link>
          {canManageQuotations(user.designation) && (
            <Link
              href="/app/quotations/new"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              New quotation
            </Link>
          )}
          <Link
            href="/app/clients"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Clients
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clients"
          value={clientCount}
          hint={newClients > 0 ? `+${newClients} in last 30 days` : "Registered"}
        />
        <StatCard
          label="Samples"
          value={sampleCount}
          hint={`${inProgressSamples} in progress`}
        />
        <StatCard
          label="Open quotations"
          value={openQuotes}
          hint="Draft or sent"
        />
        <StatCard
          label="Accepted quote value"
          value={pkr(wonValue._sum.subtotal ?? 0)}
          hint={`${pkr(openValue._sum.subtotal ?? 0)} in pipeline`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sample pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sampleCount === 0 ? (
              <p className="text-sm text-muted-foreground">No samples yet.</p>
            ) : (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  {SAMPLE_STAGES.map((s) => {
                    const n = sampleCounts[s.key] ?? 0;
                    if (n === 0) return null;
                    return (
                      <div
                        key={s.key}
                        className={s.color}
                        style={{ width: `${(n / sampleCount) * 100}%` }}
                        title={`${s.label}: ${n}`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                  {SAMPLE_STAGES.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="ml-auto font-medium tabular-nums">
                        {sampleCounts[s.key] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotation funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {QUOTE_STAGES.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {quoteCounts[s.key] ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pkr(quoteSums[s.key] ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent samples
            </h2>
            <Link href="/app/samples" className="text-xs underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSamples.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/app/samples/${s.id}`} className="underline">
                        {s.labId}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate">
                      {s.client.company}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SAMPLE_BADGE[s.status] ?? "outline"}>
                        {s.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(s.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {recentSamples.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No samples yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent quotations
            </h2>
            <Link href="/app/quotations" className="text-xs underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote No</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQuotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/app/quotations/${q.id}`} className="underline">
                        {q.quoteNo}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate">
                      {q.client.company}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pkr(q.subtotal)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          QUOTE_STAGES.find((x) => x.key === q.status)?.variant ??
                          "outline"
                        }
                      >
                        {q.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {recentQuotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No quotations yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
