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
  const nav = active
    ? [
        { href: "/app", label: "Dashboard" },
        { href: "/app/personnel", label: "Personnel" },
        { href: "/app/functions", label: "Functions" },
        { href: "/app/attendance", label: "Attendance" },
        { href: "/app/leave", label: "Leave" },
        { href: "/app/undertaking", label: "Undertaking" },
        { href: "/app/logs", label: "Activity Log" },
      ]
    : [{ href: "/app/onboarding", label: "Complete profile" }];

  return (
    <div className="grid min-h-svh grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-1 border-r bg-muted/30 p-4">
        <div className="mb-4 px-3 text-sm font-semibold">BECS LIMS</div>
        {nav.map((n) => (
          <NavLink key={n.href} href={n.href}>
            {n.label}
          </NavLink>
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
