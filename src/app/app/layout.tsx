import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const active = user.status === "ACTIVE";
  const groups = active
    ? [
        {
          title: "Overview",
          items: [
            { href: "/app", label: "Dashboard" },
            { href: "/app/logs", label: "Activity Log" },
          ],
        },
        {
          title: "Personnel",
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
          items: [
            { href: "/app/clients", label: "Clients" },
            { href: "/app/samples", label: "Samples" },
            { href: "/app/parameters", label: "Parameters" },
          ],
        },
        {
          title: "Inventory & Procurement",
          items: [
            { href: "/app/vendors", label: "Vendors" },
            { href: "/app/procurement", label: "Purchase Requests" },
            { href: "/app/inventory", label: "Stores & Inventory" },
          ],
        },
        {
          title: "Equipment & Traceability",
          items: [
            { href: "/app/equipment", label: "Equipment" },
            { href: "/app/materials", label: "Materials" },
          ],
        },
        {
          title: "Finance & Payroll",
          items: [
            { href: "/app/finance", label: "Ledger" },
            { href: "/app/finance/invoices", label: "Invoices" },
            { href: "/app/finance/payroll", label: "Payroll" },
          ],
        },
      ]
    : [
        {
          title: "",
          items: [{ href: "/app/onboarding", label: "Complete profile" }],
        },
      ];

  return (
    <div className="grid min-h-svh grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-1 overflow-y-auto border-r bg-muted/30 p-4">
        <div className="mb-2 px-3 text-sm font-semibold">BECS LIMS</div>
        {groups.map((g) => (
          <div key={g.title} className="mb-1 flex flex-col gap-0.5">
            {g.title && (
              <div className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.title}
              </div>
            )}
            {g.items.map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
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
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
