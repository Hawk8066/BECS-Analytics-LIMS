import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { StatCard } from "@/components/stat-card";
import { AuditLogTable } from "@/components/audit-log-table";
import { getAuditLogs } from "@/lib/audit/query";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const scope = readScope(user);
  const today = startOfToday();

  const [
    headcount,
    pendingProfiles,
    pendingFunctions,
    pendingLeave,
    presentToday,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { ...scope, status: { not: "NON_ACTIVE" } } }),
    prisma.user.count({ where: { ...scope, status: "PENDING_APPROVAL" } }),
    prisma.function.count({ where: { approvedAt: null } }),
    prisma.leaveApplication.count({ where: { ...scope, status: "PENDING" } }),
    prisma.attendance.count({
      where: { ...scope, date: today, checkIn: { not: null } },
    }),
    getAuditLogs(user, { take: 8 }),
  ]);

  const [samplesTotal, samplesAwaiting, prsPending, equipNeedsCal] =
    await Promise.all([
      prisma.sample.count({ where: scope }),
      prisma.sample.count({ where: { ...scope, status: "REGISTERED" } }),
      prisma.purchaseRequest.count({
        where: { ...scope, status: { in: ["SUBMITTED", "VERIFIED"] } },
      }),
      prisma.equipment.count({
        where: { ...scope, calibrations: { none: { validUntil: { gte: new Date() } } } },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} &middot; {user.designation}
          {user.canReadCrossSection ? " · all sections" : " · your section"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active personnel" value={headcount} />
        <StatCard
          label="Profiles awaiting COO"
          value={pendingProfiles}
          hint="Pending approval"
        />
        <StatCard
          label="Functions awaiting COO"
          value={pendingFunctions}
          hint="Pending approval"
        />
        <StatCard label="Leave pending" value={pendingLeave} />
        <StatCard label="Checked in today" value={presentToday} />
        <StatCard label="Samples (scope)" value={samplesTotal} />
        <StatCard
          label="Samples awaiting assignment"
          value={samplesAwaiting}
        />
        <StatCard label="PRs pending" value={prsPending} hint="Submitted/verified" />
        <StatCard
          label="Equipment needing calibration"
          value={equipNeedsCal}
          hint="Expired or none"
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent activity
        </h2>
        <AuditLogTable logs={recentLogs} />
      </div>
    </div>
  );
}
