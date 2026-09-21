"use client";

import { Boxes, FileText, LayoutDashboard, Settings, TrendingUp } from "lucide-react";
import {
  SidebarShell,
  SidebarSection,
  SidebarLink,
} from "@/components/sidebar-shell";

/**
 * Production QC navigation.
 *
 * The shell, the rail and the per-section fold all come from
 * `components/sidebar-shell`, shared with the main app — so the two sidebars
 * behave identically and only their contents differ.
 */
export function QcSidebar({
  canManage,
  isAdmin,
}: {
  canManage: boolean;
  isAdmin: boolean;
}) {
  return (
    <SidebarShell storageKey="becs.btfqc.nav.rail">
      <SidebarSection title="Production QC" tone="#3d7a20">
        <SidebarLink href="/btf-qc" label="Lots" icon={Boxes} exact />
        <SidebarLink
          href="/btf-qc/dashboard"
          label="Dashboard"
          icon={LayoutDashboard}
        />
        <SidebarLink href="/btf-qc/reports" label="Monthly reports" icon={FileText} />
        {canManage && (
          <SidebarLink
            href="/btf-qc/performance"
            label="Performance"
            icon={TrendingUp}
          />
        )}
      </SidebarSection>

      {isAdmin && (
        <SidebarSection title="Administration" tone="#7a3350">
          <SidebarLink href="/btf-qc/settings" label="Settings" icon={Settings} />
        </SidebarSection>
      )}
    </SidebarShell>
  );
}
