import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { clientSampleCount } from "@/lib/portal/client";
import { BecsLogo } from "@/components/becs-logo";
import { ClientSidebar } from "./portal-sidebar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../app/actions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Only external client accounts use the portal; staff go to /app.
  if (user.designation !== "CLIENT" || !user.clientId) redirect("/app");

  const [client, samples] = await Promise.all([
    prisma.client.findUnique({
      where: { id: user.clientId },
      select: { company: true, clientNo: true },
    }),
    clientSampleCount(user.clientId),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <BecsLogo subtitle="Client Portal" />
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium">{client?.company ?? user.email}</div>
            <div className="text-xs text-muted-foreground">{client?.clientNo}</div>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <ClientSidebar samples={samples} />
        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
