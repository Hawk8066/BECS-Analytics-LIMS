import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAccessProductionQc } from "@/lib/auth/perms";
import { designationLabel } from "@/lib/labels";
import { BecsLogo } from "@/components/becs-logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../app/actions";

// BTF Quality Control portal (Bio Tech Fertilizers, BECS RYK). A separate
// branded area for production QC & traceability, signed into by the same staff
// who run QC (COO / OM / RYK Lab Manager / Analysts) — not a locked portal.
export default async function BtfQcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=%2Fbtf-qc");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canAccessProductionQc(user.designation)) redirect("/app");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <BecsLogo subtitle="BTF Quality Control · BECS RYK" />
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium">{user.email}</div>
            <div className="text-xs text-muted-foreground">
              {designationLabel(user.designation)}
            </div>
          </div>
          <Link
            href="/app"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            BECS LIMS →
          </Link>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">{children}</main>
    </div>
  );
}
