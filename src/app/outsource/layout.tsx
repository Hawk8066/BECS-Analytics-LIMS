import { prisma } from "@/lib/db";
import { pendingCount, requireOutsourceLab } from "@/lib/portal/outsource";
import { OutsourceSidebar } from "./portal-sidebar";
import { BecsLogo } from "@/components/becs-logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../app/actions";

export default async function OutsourceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, labId } = await requireOutsourceLab();

  const [lab, pending] = await Promise.all([
    prisma.outsourceLab.findUnique({
      where: { id: labId },
      select: { name: true, labNo: true },
    }),
    pendingCount(labId),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <BecsLogo subtitle="Outsource Lab Portal" />
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium">{lab?.name ?? user.email}</div>
            <div className="text-xs text-muted-foreground">{lab?.labNo}</div>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <OutsourceSidebar pending={pending} />
        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
