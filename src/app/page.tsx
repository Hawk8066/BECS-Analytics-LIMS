import Link from "next/link";
import { BecsLogo } from "@/components/becs-logo";

const SIGNIN_LINKS = [
  { key: "lahore-lab", label: "Lahore Lab" },
  { key: "ryk-lab", label: "RYK Lab" },
  { key: "client", label: "Client" },
  { key: "vendor", label: "Vendor" },
  { key: "management", label: "Management" },
];

const MODULES = [
  { n: "01", name: "Personnel", desc: "HR, functions, competence, authorization, attendance, leave" },
  { n: "02", name: "Inventory & Procurement", desc: "Stores, procurement workflow, vendors, utilities" },
  { n: "03", name: "Samples & Client", desc: "Client/sample registration, blinding, parameters, invoices" },
  { n: "04", name: "Testing & Reporting", desc: "Methods, raw-data capture, verification, final reports" },
  { n: "05", name: "Equipment & Traceability", desc: "Calibration, repair/qualification, chemicals, glassware" },
  { n: "06", name: "Finance & Payroll", desc: "Double-entry GL, revenue, expenses, payroll" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <BecsLogo size={48} />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0e3a5c]">
            Laboratory Management System
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Lahore (Parent Lab) &middot; Rahimyar Khan (on-site QC Sub-Lab)
          </p>
        </div>
        <div className="flex max-w-[320px] flex-wrap justify-end gap-2">
          {SIGNIN_LINKS.map((s) => (
            <Link
              key={s.key}
              href={`/login?as=${s.key}`}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((m) => (
          <li
            key={m.n}
            className="rounded-lg border border-zinc-200 p-4 transition-colors hover:border-[#1ca9e6] dark:border-zinc-800"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-zinc-400">{m.n}</span>
              <h2 className="font-semibold">{m.name}</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{m.desc}</p>
          </li>
        ))}
      </ul>

      <footer className="mt-12 border-t border-zinc-200 pt-4 text-xs text-zinc-400 dark:border-zinc-800">
        Foundation: facilities &amp; sections, two-tier authorization, scoping,
        audit log, approvals, numbering. See <code>docs/SSOT.md</code>.
      </footer>
    </main>
  );
}
