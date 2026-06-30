import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { getAuditLogs } from "@/lib/audit/query";
import { AuditLogTable } from "@/components/audit-log-table";
import { AutoRefresh } from "@/components/auto-refresh";

// Always render fresh so the live poll (router.refresh) shows new entries.
export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const logs = await getAuditLogs(user, { take: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Immutable audit trail (BR-5)
            {user.canReadCrossSection ? " — all sections" : " — your section"}.
          </p>
        </div>
        <AutoRefresh intervalMs={5000} />
      </div>
      <AuditLogTable logs={logs} />
    </div>
  );
}
