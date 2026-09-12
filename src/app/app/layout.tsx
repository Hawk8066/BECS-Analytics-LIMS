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
import { getFeedSnapshot } from "@/lib/feed/query";
import { FeedProvider } from "@/components/feed/feed-provider";
import { NotificationBell } from "@/components/feed/notification-bell";
import { NewsReel } from "@/components/feed/news-reel";
import { NavLink } from "@/components/nav-link";
import { NavSection } from "@/components/nav-section";
import { BecsLogo } from "@/components/becs-logo";
import { UndertakingGate } from "@/components/undertaking-gate";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

type NavItem = { href: string; label: string; exact?: boolean };
type NavGroup = { title: string; tone: string; items: NavItem[] };

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
  const feed = showFeed
    ? await getFeedSnapshot(user)
    : { unread: 0, inbox: [], tasks: [], reel: [], watermark: "" };
  // The per-lab registers get one nav entry per lab this user may read.
  const labs = active && !undertakingDue ? await readableFacilities(user) : [];
  // Each nav section carries its own tone so the sidebar can be scanned by
  // colour. Tones are darkened brand hues so the small uppercase headings stay
  // legible (>= 4.5:1) on the light sidebar.
  const groups: NavGroup[] = active && !undertakingDue
    ? [
        {
          title: "Overview",
          tone: "#0e3a5c",
          items: [
            { href: "/app", label: "Dashboard" },
            { href: "/app/logs", label: "Activity Log" },
          ],
        },
        {
          title: "Personnel",
          tone: "#0a6ea0",
          items: [
            { href: "/app/personnel", label: "Personnel" },
            { href: "/app/functions", label: "Functions" },
            { href: "/app/attendance", label: "Attendance" },
            { href: "/app/leave", label: "Leave" },
            { href: "/app/undertaking", label: "Undertaking" },
          ],
        },
        {
          title: "Samples & Testing",
          tone: "#3d7a20",
          items: [
            { href: "/app/overview", label: "Overview" },
            { href: "/app/clients", label: "Clients" },
            { href: "/app/third-parties", label: "Third Parties" },
            { href: "/app/samples", label: "Samples" },
            // Management view — only for those who assign work and track analysts.
            ...(canCoordinateTesting(user.designation)
              ? [{ href: "/app/samples/performance", label: "Sample Performance" }]
              : []),
            { href: "/app/parameters", label: "Parameters" },
            { href: "/app/quotations", label: "Quotations" },
            // Invoicing accepted quotations — for LO / Accountant / COO / admin.
            ...(canIssueInvoice(user.designation) || canViewFinance(user.designation)
              ? [{ href: "/app/invoices", label: "Invoices" }]
              : []),
            // Subcontractor labs for outsourced parameters.
            ...(canRegisterOutsourceLab(user.designation)
              ? [{ href: "/app/outsource-labs", label: "Outsource Labs" }]
              : []),
          ],
        },
        {
          title: "Inventory & Procurement",
          tone: "#a8481c",
          items: [
            { href: "/app/vendors", label: "Vendors" },
            { href: "/app/procurement", label: "Purchase Requests" },
            { href: "/app/inventory", label: "Stores & Inventory" },
          ],
        },
        // Each lab is its own section, holding that lab's registers. A user who
        // can only read their own lab simply gets the one section.
        ...labs.map((l) => ({
          title: l.name,
          tone: l.tone,
          items: [
            {
              href: `/app/equipment/${l.slug}`,
              label: "Equipment",
              // The repairs register nests under this path — match it exactly
              // so both entries don't light up at once.
              exact: true,
            },
            { href: `/app/materials/${l.slug}`, label: "Materials" },
            { href: `/app/equipment/${l.slug}/repairs`, label: "Repairs" },
          ],
        })),
        {
          title: "Finance",
          tone: "#0f6f6a",
          items: [
            // Landing page for the section, so it must not stay lit on the pages
            // nested beneath it.
            { href: "/app/finance", label: "Dashboard", exact: true },
            { href: "/app/finance/statements", label: "Statements" },
            { href: "/app/finance/ledger", label: "Ledger" },
            // Payables: what we owe suppliers and what we owe outsource labs.
            ...(canViewFinance(user.designation)
              ? [
                  { href: "/app/finance/vendor-bills", label: "Vendor Bills" },
                  { href: "/app/finance/expenses", label: "Utilities & Expenses" },
                  { href: "/app/finance/outsource-bills", label: "External Lab Bills" },
                ]
              : []),
            // Payroll: monthly payslips + salary tax. Salary data is sensitive,
            // so it's limited to those who prepare payroll (Accountant/COO).
            ...(canManagePayroll(user.designation)
              ? [{ href: "/app/finance/payroll", label: "Payroll" }]
              : []),
          ],
        },
        // Application super-admin only (SSOT-exempt): generic data management.
        ...(user.designation === "ADMIN"
          ? [
              {
                title: "Administration",
                tone: "#7a3350",
                items: [
                  // Landing page for the section; the roles matrix nests under
                  // it, so match exactly or both entries light up at once.
                  { href: "/app/admin", label: "Data (Admin)", exact: true },
                  { href: "/app/admin/roles", label: "Roles & Capabilities" },
                ],
              },
            ]
          : []),
      ]
    : active
      ? [] // undertaking due — hide nav until signed
      : [
          {
            title: "",
            tone: "#0e3a5c",
            items: [{ href: "/app/onboarding", label: "Complete profile" }],
          },
        ];

  return (
    // On print, drop the sidebar/header and the full-height grid so only the
    // page content (e.g. a printable invoice) flows — no blank trailing pages.
    <FeedProvider initial={feed}>
    <div className="grid min-h-svh grid-cols-[220px_1fr] print:block print:min-h-0">
      <aside className="flex flex-col gap-1 overflow-y-auto border-r bg-muted/30 p-4 print:hidden">
        <div className="mb-3 px-2">
          <BecsLogo subtitle="LIMS" />
        </div>
        {groups.map((g) => {
          const links = g.items.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {n.label}
            </NavLink>
          ));
          // The onboarding stub has no heading, so nothing to fold it into.
          return g.title ? (
            <NavSection key={g.title} title={g.title} tone={g.tone}>
              {links}
            </NavSection>
          ) : (
            <div key="untitled" className="flex flex-col gap-0.5">
              {links}
            </div>
          );
        })}
      </aside>
      <div className="flex min-w-0 flex-col">
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
