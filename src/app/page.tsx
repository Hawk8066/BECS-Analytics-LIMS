import Link from "next/link";
import { BecsLogo } from "@/components/becs-logo";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/current-user";
import { homePathFor } from "@/lib/auth/entrance";
import { designationLabel } from "@/lib/labels";
import { signOutToLanding } from "./actions";

const SIGNIN_LINKS: { key: string; label: string; href?: string }[] = [
  { key: "lahore-lab", label: "Lahore Lab" },
  { key: "ryk-lab", label: "RYK Lab" },
  { key: "client", label: "Client" },
  { key: "vendor", label: "Vendor" },
  { key: "outsource", label: "Outsource Lab" },
  { key: "btf-qc", label: "BTF Quality Control", href: "/btf-qc" },
  { key: "management", label: "Management" },
];

export default async function Home() {
  // Already signed in? Don't present the entrances again — that's how a live
  // session (e.g. a Vendor) looks like it "entered" through the wrong door.
  // Show who they are and make them sign out to switch accounts/entrances.
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <BecsLogo size={64} />
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#0e3a5c]">
        Laboratory Management System
      </h1>

      {user ? (
        <div className="mt-10 flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            You are signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span> ·{" "}
            {designationLabel(user.designation)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href={homePathFor(user.designation)}>
              <Button>Continue to your portal</Button>
            </Link>
            <form action={signOutToLanding}>
              <Button variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
          <p className="text-xs text-muted-foreground">
            Sign out to use a different sign-in entrance.
          </p>
        </div>
      ) : (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {SIGNIN_LINKS.map((s) => (
            <Link
              key={s.key}
              href={s.href ?? `/login?as=${s.key}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
