import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { vendorCounts } from "@/lib/portal/vendor";
import { BecsLogo } from "@/components/becs-logo";
import { VendorSidebar } from "./portal-sidebar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../app/actions";

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "VENDOR" || !user.vendorId) redirect("/app");

  const [vendor, counts] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: user.vendorId },
      select: { company: true, vendorNo: true },
    }),
    vendorCounts(user.vendorId),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <BecsLogo subtitle="Vendor Portal" />
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium">{vendor?.company ?? user.email}</div>
            <div className="text-xs text-muted-foreground">{vendor?.vendorNo}</div>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <VendorSidebar openOrders={counts.orders} quotations={counts.quotations} />
        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
