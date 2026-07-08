import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { BecsLogo } from "@/components/becs-logo";
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

  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { company: true, clientNo: true },
  });

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
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
    </div>
  );
}
