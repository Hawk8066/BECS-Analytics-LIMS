import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { ANALYST_DESIGNATIONS, canCoordinateTesting } from "@/lib/auth/perms";
import { sampleListWhere } from "@/lib/samples/access";
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

// The testing pipeline, grouped into the three states an operator cares about:
// just booked, being worked on, and done.
const STAGES = [
  { key: "REGISTERED", label: "Booked", group: "booked", color: "bg-slate-400" },
  { key: "ASSIGNED", label: "Assigned", group: "progress", color: "bg-blue-400" },
  { key: "RESULTS_ENTERED", label: "Results in", group: "progress", color: "bg-indigo-400" },
  { key: "VERIFIED", label: "Verified", group: "progress", color: "bg-violet-400" },
  { key: "APPROVED", label: "Approved", group: "done", color: "bg-emerald-400" },
  { key: "REPORTED", label: "Reported", group: "done", color: "bg-emerald-600" },
] as const;

const ACTIVE_STATUSES = ["ASSIGNED", "RESULTS_ENTERED", "VERIFIED"] as const;
const DONE_STATUSES = ["APPROVED", "REPORTED"] as const;

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  REGISTERED: "outline",
  ASSIGNED: "secondary",
  RESULTS_ENTERED: "secondary",
  VERIFIED: "secondary",
  APPROVED: "default",
  REPORTED: "default",
};

const prettyStatus = (s: string) => s.replace(/_/g, " ").toLowerCase();

const daysSince = (from: Date, now: number) =>
  Math.max(0, Math.floor((now - from.getTime()) / 86_400_000));

export default async function SamplePerformancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  // A management view: coordinators assign work and watch throughput.
  if (!canCoordinateTesting(user.designation)) redirect("/app/samples");

  const scope = sampleListWhere(user);
  const facilityScope = user.canReadCrossSection
    ? {}
    : { facilityId: user.facilityId };

  const [byStatus, paramAssignments, analysts, active, unassigned] = await Promise.all([
    // Totals per status, for the KPI row and the pipeline bar.
    prisma.sample.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    // Per-parameter analyst assignments in scope. Assignment is per-parameter, so
    // an analyst's load is the distinct samples they hold at least one test on.
    prisma.sampleParameter.findMany({
      where: { assignedToId: { not: null }, sample: scope },
      select: { assignedToId: true, sample: { select: { id: true, status: true } } },
    }),
    // Every analyst in scope, so an idle one still shows (with a zero load).
    prisma.user.findMany({
      where: {
        designation: { in: [...ANALYST_DESIGNATIONS] },
        status: "ACTIVE",
        ...facilityScope,
      },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    }),
    // Samples currently on someone's bench, oldest first (most at risk).
    prisma.sample.findMany({
      where: { ...scope, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        labId: true,
        sampleType: true,
        status: true,
        createdAt: true,
        parameters: { select: { assignedToId: true } },
      },
    }),
    // Booked but not yet handed to an analyst — the queue to clear.
    prisma.sample.findMany({
      where: { ...scope, status: "REGISTERED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, labId: true, sampleType: true, createdAt: true },
    }),
  ]);

  // Server component: renders once per request on the server, so a single clock
  // read here is deterministic for this response (not a client re-render hazard).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const counts: Record<string, number> = {};
  for (const r of byStatus) counts[r.status] = r._count._all;
  const sum = (keys: readonly string[]) =>
    keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

  const total = byStatus.reduce((n, r) => n + r._count._all, 0);
  const booked = counts.REGISTERED ?? 0;
  const inProgress = sum(ACTIVE_STATUSES);
  const finished = sum(DONE_STATUSES);

  // Resolve analyst names for everyone who holds a sample, even if they're not
  // in the ANALYST list (e.g. a Lab Manager who self-assigned).
  const nameById = new Map<string, string>();
  for (const a of analysts) nameById.set(a.id, a.profile?.fullName ?? a.email);
  const assignedIds = new Set<string>();
  for (const r of paramAssignments) if (r.assignedToId) assignedIds.add(r.assignedToId);
  for (const s of active)
    for (const p of s.parameters) if (p.assignedToId) assignedIds.add(p.assignedToId);
  const missingIds = [...assignedIds].filter((id) => !nameById.has(id));
  if (missingIds.length > 0) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    });
    for (const a of extra) nameById.set(a.id, a.profile?.fullName ?? a.email);
  }

  // Each analyst's load = the distinct samples they hold at least one test on,
  // split by the sample's stage. Sets dedupe a sample with several of an
  // analyst's parameters. Start from the roster so idle analysts still appear.
  type Load = { id: string; name: string; active: number; done: number; total: number };
  type Acc = { all: Set<string>; active: Set<string>; done: Set<string> };
  const accById = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = accById.get(id);
    if (!a) {
      a = { all: new Set(), active: new Set(), done: new Set() };
      accById.set(id, a);
    }
    return a;
  };
  for (const a of analysts) ensure(a.id);
  for (const r of paramAssignments) {
    if (!r.assignedToId) continue;
    const acc = ensure(r.assignedToId);
    acc.all.add(r.sample.id);
    if ((ACTIVE_STATUSES as readonly string[]).includes(r.sample.status))
      acc.active.add(r.sample.id);
    else if ((DONE_STATUSES as readonly string[]).includes(r.sample.status))
      acc.done.add(r.sample.id);
  }
  const loads: Load[] = [...accById.entries()]
    .map(([id, a]) => ({
      id,
      name: nameById.get(id) ?? "—",
      active: a.active.size,
      done: a.done.size,
      total: a.all.size,
    }))
    .sort(
      (a, b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name),
    );
  const activeAnalysts = loads.filter((l) => l.active > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sample performance</h1>
          <p className="text-sm text-muted-foreground">
            Workload &amp; throughput
            {user.canReadCrossSection ? " · all sections" : " · your section"} · client
            identity blinded
          </p>
        </div>
        <Link href="/app/samples" className={buttonVariants({ size: "sm", variant: "outline" })}>
          All samples
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Just booked" value={booked} hint="Awaiting an analyst" />
        <StatCard
          label="In progress"
          value={inProgress}
          hint={`${activeAnalysts} analyst${activeAnalysts === 1 ? "" : "s"} working`}
        />
        <StatCard label="Finished" value={finished} hint="Approved or reported" />
        <StatCard label="Total samples" value={total} hint="In scope" />
      </div>

      {/* Pipeline bar + legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">No samples yet.</p>
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {STAGES.map((s) => {
                  const n = counts[s.key] ?? 0;
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
                      {counts[s.key] ?? 0}
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
                <TableHead className="text-right">Finished</TableHead>
                <TableHead className="text-right">Total handled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.active > 0 ? (
                      l.active
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {l.done}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.total}</TableCell>
                </TableRow>
              ))}
              {loads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No analysts in scope.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Unassigned queue */}
      {unassigned.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Waiting to be assigned ({unassigned.length})
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassigned.map((s) => {
                  const age = daysSince(s.createdAt, now);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/app/samples/${s.id}`} className="underline">
                          {s.labId}
                        </Link>
                      </TableCell>
                      <TableCell>{s.sampleType}</TableCell>
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

      {/* Who has what, right now */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          In progress — who has what ({active.length})
        </h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Analyst</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((s) => {
                const age = daysSince(s.createdAt, now);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/app/samples/${s.id}`} className="underline">
                        {s.labId}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate">{s.sampleType}</TableCell>
                    <TableCell>
                      {(() => {
                        const names = [
                          ...new Set(
                            s.parameters
                              .map((p) => p.assignedToId)
                              .filter((id): id is string => !!id)
                              .map((id) => nameById.get(id) ?? "—"),
                          ),
                        ].sort((a, b) => a.localeCompare(b));
                        return names.length > 0 ? (
                          names.join(", ")
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[s.status] ?? "outline"}>
                        {prettyStatus(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={age >= 7 ? "font-medium text-amber-600" : "text-muted-foreground"}
                        title={`Registered ${formatDate(s.createdAt)}`}
                      >
                        {age === 0 ? "today" : `${age}d`}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
