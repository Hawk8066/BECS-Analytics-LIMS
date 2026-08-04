import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { BecsLogo } from "@/components/becs-logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../app/actions";

export default async function OutsourceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "OUTSOURCE_LAB" || !user.outsourceLabId)
    redirect("/app");

  const lab = await prisma.outsourceLab.findUnique({
    where: { id: user.outsourceLabId },
    select: { name: true, labNo: true },
  });

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
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
    </div>
  );
}
