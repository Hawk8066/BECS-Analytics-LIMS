import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isUndertakingDue, undertakingYear } from "@/lib/undertaking/status";
import {
  canCoordinateTesting,
  canIssueInvoice,
  canViewFinance,
  canManagePayroll,
  canRegisterOutsourceLab,
} from "@/lib/auth/perms";
import { readableFacilities } from "@/lib/facilities";
import { getFeedSnapshot, EMPTY_SNAPSHOT } from "@/lib/feed/query";
import { FeedProvider } from "@/components/feed/feed-provider";
import { NotificationBell } from "@/components/feed/notification-bell";
import { NewsReel } from "@/components/feed/news-reel";
import { UndertakingGate } from "@/components/undertaking-gate";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // External accounts belong in their own portals, not the staff app.
  if (user.designation === "CLIENT") redirect("/portal");
  if (user.designation === "VENDOR") redirect("/vendor");
  if (user.designation === "OUTSOURCE_LAB") redirect("/outsource");

  const active = user.status === "ACTIVE";
  // Force the yearly undertaking before any app usage (first login + each 1 Jan).
  const undertakingDue = active ? await isUndertakingDue(user.id) : false;
  // The undertaking gate is a hard block, so the feed stays hidden behind it too.
  // Server-rendering the first snapshot avoids an empty-bell flash; the client
  // then polls /api/feed for deltas.
  const showFeed = active && !undertakingDue;
  const feed = showFeed ? await getFeedSnapshot(user) : EMPTY_SNAPSHOT;
  // The per-lab registers get one nav entry per lab this user may read.
  const labs = active && !undertakingDue ? await readableFacilities(user) : [];
  return (
    // On print, drop the sidebar/header and the full-height grid so only the
    // page content (e.g. a printable invoice) flows — no blank trailing pages.
    <FeedProvider initial={feed}>
    <div className="flex min-h-svh print:block print:min-h-0">
      <AppSidebar
        active={active}
        undertakingDue={undertakingDue}
        isAdmin={user.designation === "ADMIN"}
        canCoordinateTesting={canCoordinateTesting(user.designation)}
        canIssueInvoice={canIssueInvoice(user.designation)}
        canViewFinance={canViewFinance(user.designation)}
        canManagePayroll={canManagePayroll(user.designation)}
        canRegisterOutsourceLab={canRegisterOutsourceLab(user.designation)}
        labs={labs}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3 print:hidden">
          <div className="text-sm text-muted-foreground">
            {user.email} &middot;{" "}
            <span className="font-medium text-foreground">
              {user.designation}
            </span>
            {!active && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                {user.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showFeed && <NotificationBell />}
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        {showFeed && <NewsReel />}
        <main className="min-w-0 flex-1 p-6 print:p-0">
          {undertakingDue ? <UndertakingGate year={undertakingYear()} /> : children}
        </main>
      </div>
    </div>
    </FeedProvider>
  );
}
