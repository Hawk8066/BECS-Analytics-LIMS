import Link from "next/link";
import { BecsLogo } from "@/components/becs-logo";

const SIGNIN_LINKS: { key: string; label: string; href?: string }[] = [
  { key: "lahore-lab", label: "Lahore Lab" },
  { key: "ryk-lab", label: "RYK Lab" },
  { key: "client", label: "Client" },
  { key: "vendor", label: "Vendor" },
  { key: "outsource", label: "Outsource Lab" },
  { key: "btf-qc", label: "BTF Quality Control", href: "/btf-qc" },
  { key: "management", label: "Management" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <BecsLogo size={64} />
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#0e3a5c]">
        Laboratory Management System
      </h1>

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
    </main>
  );
}
