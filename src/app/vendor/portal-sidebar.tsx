"use client";

import { Building2, FileText, ClipboardList } from "lucide-react";
import {
  SidebarShell,
  SidebarSection,
  SidebarLink,
} from "@/components/sidebar-shell";

/** Vendor portal navigation — the same shell the staff app uses. */
export function VendorSidebar({
  openOrders,
  quotations,
}: {
  openOrders: number;
  quotations: number;
}) {
  return (
    <SidebarShell storageKey="becs.vendor.nav.rail">
      <SidebarSection title="Vendor portal" tone="#a8481c">
        <SidebarLink
          href="/vendor"
          label="Purchase orders"
          icon={ClipboardList}
          badge={openOrders}
          exact
        />
        <SidebarLink
          href="/vendor/quotations"
          label="My quotations"
          icon={FileText}
          badge={quotations}
        />
        <SidebarLink href="/vendor/profile" label="My details" icon={Building2} />
      </SidebarSection>
    </SidebarShell>
  );
}
