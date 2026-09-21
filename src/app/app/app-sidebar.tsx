"use client";

import {
  Banknote,
  BookOpen,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  Database,
  FileBarChart,
  FileInput,
  FileSignature,
  FileText,
  FlaskConical,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Microscope,
  Network,
  Package,
  PieChart,
  Receipt,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Telescope,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { BecsLogo } from "@/components/becs-logo";
import {
  SidebarShell,
  SidebarSection,
  SidebarLink,
} from "@/components/sidebar-shell";

export interface SidebarLab {
  name: string;
  slug: string;
  tone: string;
}

/**
 * Main application navigation.
 *
 * A client component because the icon for each entry is a component, and a
 * function cannot be passed from a server component across the client boundary.
 * So the layout hands over plain booleans and lab data, and the structure is
 * assembled here — the same shape `QcSidebar` uses.
 *
 * Section tones are darkened brand hues chosen so the small uppercase headings
 * stay legible (>= 4.5:1) on the light sidebar.
 */
export function AppSidebar({
  active,
  undertakingDue,
  isAdmin,
  canCoordinateTesting,
  canIssueInvoice,
  canViewFinance,
  canManagePayroll,
  canRegisterOutsourceLab,
  labs,
}: {
  active: boolean;
  undertakingDue: boolean;
  isAdmin: boolean;
  canCoordinateTesting: boolean;
  canIssueInvoice: boolean;
  canViewFinance: boolean;
  canManagePayroll: boolean;
  canRegisterOutsourceLab: boolean;
  labs: SidebarLab[];
}) {
  const brand = <BecsLogo subtitle="LIMS" />;

  // Undertaking due: a hard block, so the nav stays empty until it is signed.
  if (active && undertakingDue)
    return <SidebarShell storageKey="becs.app.nav.rail" brand={brand} />;

  if (!active)
    return (
      <SidebarShell storageKey="becs.app.nav.rail" brand={brand}>
        <div className="flex flex-col gap-0.5">
          <SidebarLink
            href="/app/onboarding"
            label="Complete profile"
            icon={UserPlus}
          />
        </div>
      </SidebarShell>
    );

  return (
    <SidebarShell storageKey="becs.app.nav.rail" brand={brand}>
      <SidebarSection title="Overview" tone="#0e3a5c">
        <SidebarLink href="/app" label="Dashboard" icon={LayoutDashboard} exact />
        <SidebarLink href="/app/logs" label="Activity Log" icon={ScrollText} />
      </SidebarSection>

      <SidebarSection title="Personnel" tone="#0a6ea0">
        <SidebarLink href="/app/personnel" label="Personnel" icon={Users} />
        <SidebarLink href="/app/functions" label="Functions" icon={ShieldCheck} />
        <SidebarLink href="/app/attendance" label="Attendance" icon={CalendarCheck} />
        <SidebarLink href="/app/leave" label="Leave" icon={CalendarOff} />
        <SidebarLink
          href="/app/undertaking"
          label="Undertaking"
          icon={FileSignature}
        />
      </SidebarSection>

      <SidebarSection title="Samples & Testing" tone="#3d7a20">
        <SidebarLink href="/app/overview" label="Overview" icon={Telescope} />
        <SidebarLink href="/app/clients" label="Clients" icon={Building2} />
        <SidebarLink
          href="/app/third-parties"
          label="Third Parties"
          icon={Handshake}
        />
        {/* Deliberately not exact, matching the previous NavLink behaviour: it
            stays lit on a sample's own page. The cost is that the performance
            view below lights it too, which was true before this refactor. */}
        <SidebarLink href="/app/samples" label="Samples" icon={FlaskConical} />
        {/* Management view — only for those who assign work and track analysts. */}
        {canCoordinateTesting && (
          <SidebarLink
            href="/app/samples/performance"
            label="Sample Performance"
            icon={TrendingUp}
          />
        )}
        <SidebarLink
          href="/app/parameters"
          label="Parameters"
          icon={SlidersHorizontal}
        />
        <SidebarLink href="/app/quotations" label="Quotations" icon={FileText} />
        {/* Invoicing accepted quotations — LO / Accountant / COO / admin. */}
        {(canIssueInvoice || canViewFinance) && (
          <SidebarLink href="/app/invoices" label="Invoices" icon={Receipt} />
        )}
        {/* Subcontractor labs for outsourced parameters. */}
        {canRegisterOutsourceLab && (
          <SidebarLink
            href="/app/outsource-labs"
            label="Outsource Labs"
            icon={Network}
          />
        )}
      </SidebarSection>

      <SidebarSection title="Inventory & Procurement" tone="#a8481c">
        <SidebarLink href="/app/vendors" label="Vendors" icon={Truck} />
        <SidebarLink
          href="/app/procurement"
          label="Purchase Requests"
          icon={ClipboardList}
        />
        <SidebarLink
          href="/app/inventory"
          label="Stores & Inventory"
          icon={Package}
        />
      </SidebarSection>

      {/* Each lab is its own section, holding that lab's registers. A user who
          can only read their own lab simply gets the one section. */}
      {labs.map((l) => (
        <SidebarSection key={l.slug} title={l.name} tone={l.tone}>
          {/* The repairs register nests under this path — match it exactly so
              both entries don't light up at once. */}
          <SidebarLink
            href={`/app/equipment/${l.slug}`}
            label="Equipment"
            icon={Microscope}
            exact
          />
          <SidebarLink
            href={`/app/materials/${l.slug}`}
            label="Materials"
            icon={Boxes}
          />
          <SidebarLink
            href={`/app/equipment/${l.slug}/repairs`}
            label="Repairs"
            icon={Wrench}
          />
        </SidebarSection>
      ))}

      <SidebarSection title="Finance" tone="#0f6f6a">
        {/* Landing page for the section, so it must not stay lit on the pages
            nested beneath it. */}
        <SidebarLink href="/app/finance" label="Dashboard" icon={PieChart} exact />
        <SidebarLink
          href="/app/finance/statements"
          label="Statements"
          icon={FileBarChart}
        />
        <SidebarLink href="/app/finance/ledger" label="Ledger" icon={BookOpen} />
        {/* Payables: what we owe suppliers and what we owe outsource labs. */}
        {canViewFinance && (
          <>
            <SidebarLink
              href="/app/finance/vendor-bills"
              label="Vendor Bills"
              icon={FileText}
            />
            <SidebarLink
              href="/app/finance/expenses"
              label="Utilities & Expenses"
              icon={Zap}
            />
            <SidebarLink
              href="/app/finance/outsource-bills"
              label="External Lab Bills"
              icon={FileInput}
            />
          </>
        )}
        {/* Payroll: monthly payslips + salary tax. Salary data is sensitive, so
            it's limited to those who prepare payroll (Accountant/COO). */}
        {canManagePayroll && (
          <SidebarLink
            href="/app/finance/payroll"
            label="Payroll"
            icon={Banknote}
          />
        )}
      </SidebarSection>

      {/* Application super-admin only (SSOT-exempt): generic data management. */}
      {isAdmin && (
        <SidebarSection title="Administration" tone="#7a3350">
          {/* Landing page for the section; the roles matrix nests under it, so
              match exactly or both entries light up at once. */}
          <SidebarLink
            href="/app/admin"
            label="Data (Admin)"
            icon={Database}
            exact
          />
          <SidebarLink
            href="/app/admin/roles"
            label="Roles & Capabilities"
            icon={KeyRound}
          />
        </SidebarSection>
      )}
    </SidebarShell>
  );
}
