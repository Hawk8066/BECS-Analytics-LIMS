import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageProductionQc } from "@/lib/auth/perms";
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

// QC lot flow: booked (with/without an analyst) → submitted → approved/rejected.
// The pipeline splits BOOKED by whether an analyst holds it, since that's the
// difference between "needs assigning" and "on the bench".
const STAGES = [
  { key: "queue", label: "Awaiting assignment", color: "bg-amber-400" },
  { key: "onBench", label: "With analyst", color: "bg-blue-400" },
  { key: "SUBMITTED", label: "Awaiting review", color: "bg-indigo-400" },
  { key: "APPROVED", label: "Approved", color: "bg-emerald-500" },
  { key: "REJECTED", label: "Rejected", color: "bg-rose-500" },
] as const;

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  BOOKED: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

const daysSince = (from: Date, now: number) =>
  Math.max(0, Math.floor((now - from.getTime()) / 86_400_000));

export default async function ProductionPerformancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  // A management view: the Lab Manager books, assigns and reviews QC lots.
  if (!canManageProductionQc(user.designation)) redirect("/btf-qc");

  const facilityScope = user.canReadCrossSection
    ? {}
    : { facilityId: user.facilityId };

  // QC lots are few; fetch the fields we need and aggregate in JS (as the QC
  // dashboard does) rather than firing a dozen count/groupBy queries.
  const [lots, products, analystUsers] = await Promise.all([
    prisma.qcLot.findMany({
      where: facilityScope,
      select: {
        id: true,
        lotNo: true,
        refNo: true,
        status: true,
        verdict: true,
        resultValue: true,
        assignedToId: true,
        productTypeId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.productType.findMany({ select: { id: true, name: true, unit: true } }),
    // Production QC is run at RYK; that's the analyst pool for this board.
    prisma.user.findMany({
      where: { designation: "ANALYST", status: "ACTIVE", facility: { code: "RYK" } },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    }),
  ]);

  // Server render → one deterministic clock read for this response.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const productById = new Map(products.map((p) => [p.id, p]));

  // A lot is "active" while it's on an analyst's bench or awaiting review.
  const isQueue = (l: (typeof lots)[number]) => l.status === "BOOKED" && !l.assignedToId;
  const isOnBench = (l: (typeof lots)[number]) => l.status === "BOOKED" && !!l.assignedToId;
  const isActive = (l: (typeof lots)[number]) => isOnBench(l) || l.status === "SUBMITTED";

  const stageCount: Record<string, number> = {
    queue: 0,
    onBench: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const l of lots) {
    if (isQueue(l)) stageCount.queue++;
    else if (isOnBench(l)) stageCount.onBench++;
    else stageCount[l.status] = (stageCount[l.status] ?? 0) + 1;
  }

  const total = lots.length;
  const inProgress = stageCount.onBench + stageCount.SUBMITTED;
  const judged = lots.filter((l) => l.verdict === "PASS" || l.verdict === "FAIL");
  const passes = judged.filter((l) => l.verdict === "PASS").length;
  const passRate = judged.length ? Math.round((passes / judged.length) * 100) : null;

  // Analyst names — roster first, then any assignee not on the roster.
  const nameById = new Map<string, string>();
  for (const a of analystUsers) nameById.set(a.id, a.profile?.fullName ?? a.email);
  const missing = [
    ...new Set(lots.map((l) => l.assignedToId).filter((id): id is string => !!id)),
  ].filter((id) => !nameById.has(id));
  if (missing.length > 0) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    });
    for (const a of extra) nameById.set(a.id, a.profile?.fullName ?? a.email);
  }

  // Per-analyst load. Roster seeds the map so an idle analyst still appears.
  type Load = {
    id: string;
    name: string;
    active: number;
    approved: number;
    pass: number;
    fail: number;
    total: number;
  };
  const loadById = new Map<string, Load>();
  const ensure = (id: string): Load => {
    let l = loadById.get(id);
    if (!l) {
      l = { id, name: nameById.get(id) ?? "—", active: 0, approved: 0, pass: 0, fail: 0, total: 0 };
      loadById.set(id, l);
    }
    return l;
  };
  for (const a of analystUsers) ensure(a.id);
  for (const l of lots) {
    if (!l.assignedToId) continue;
    const load = ensure(l.assignedToId);
    load.total++;
    if (isActive(l)) load.active++;
    if (l.status === "APPROVED") load.approved++;
    if (l.verdict === "PASS") load.pass++;
    else if (l.verdict === "FAIL") load.fail++;
  }
  const loads = [...loadById.values()].sort(
    (a, b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name),
  );
  const activeAnalysts = loads.filter((l) => l.active > 0).length;

  const queue = lots.filter(isQueue);
  const active = lots.filter(isActive);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/btf-qc" className="underline">
              Production QC
            </Link>{" "}
            / Performance
          </p>
          <h1 className="text-2xl font-semibold">QC performance</h1>
          <p className="text-sm text-muted-foreground">
            Analyst workload &amp; lot throughput
            {user.canReadCrossSection ? "" : " · your facility"}
          </p>
        </div>
        <Link
          href="/btf-qc/dashboard"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          QC dashboard
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting assignment" value={stageCount.queue} hint="Booked, no analyst" />
        <StatCard
          label="In progress"
          value={inProgress}
          hint={`${activeAnalysts} analyst${activeAnalysts === 1 ? "" : "s"} working`}
        />
        <StatCard label="Approved" value={stageCount.APPROVED} hint="Reviewed & released" />
        <StatCard
          label="Pass rate"
          value={passRate == null ? "—" : `${passRate}%`}
          hint={`${judged.length} judged`}
        />
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">No lots yet.</p>
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {STAGES.map((s) => {
                  const n = stageCount[s.key] ?? 0;
                  if (n === 0) return null;
                  return (
                    <div
                      key={s.key}
                      className={s.color}
                      style={{ width: `${(n / total) * 100}%` }}
                      title={`${s.label}: ${n}`}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                {STAGES.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="ml-auto font-medium tabular-nums">
                      {stageCount[s.key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Analyst workload */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Analyst workload</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Analyst</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Pass</TableHead>
                <TableHead className="text-right">Fail</TableHead>
                <TableHead className="text-right">Total handled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.active > 0 ? l.active : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {l.approved}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-green-700">{l.pass}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">{l.fail}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.total}</TableCell>
                </TableRow>
              ))}
              {loads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No analysts in scope.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Awaiting assignment */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Waiting to be assigned ({queue.length})
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab No</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((l) => {
                  const age = daysSince(l.createdAt, now);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/btf-qc/${l.id}`} className="underline">
                          {l.lotNo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {productById.get(l.productTypeId)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">{l.refNo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={age >= 3 ? "font-medium text-amber-600" : "text-muted-foreground"}>
                          {age === 0 ? "today" : `${age}d`}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Who has what */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          In progress — who has what ({active.length})
        </h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Analyst</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((l) => {
                const age = daysSince(l.createdAt, now);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/btf-qc/${l.id}`} className="underline">
                        {l.lotNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {productById.get(l.productTypeId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">{l.refNo}</TableCell>
                    <TableCell>
                      {l.assignedToId ? (
                        nameById.get(l.assignedToId) ?? "—"
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[l.status] ?? "outline"}>
                        {l.status === "BOOKED" ? "with analyst" : l.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={age >= 7 ? "font-medium text-amber-600" : "text-muted-foreground"}
                        title={`Booked ${formatDate(l.createdAt)}`}
                      >
                        {age === 0 ? "today" : `${age}d`}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nothing in progress.
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
