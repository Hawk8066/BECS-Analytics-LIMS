"use client";

import { CheckCircle2, ClipboardList } from "lucide-react";
import {
  SidebarShell,
  SidebarSection,
  SidebarLink,
} from "@/components/sidebar-shell";

/** Outsource-lab portal navigation — the same shell the staff app uses. */
export function OutsourceSidebar({ pending }: { pending: number }) {
  return (
    <SidebarShell storageKey="becs.outsource.nav.rail">
      <SidebarSection title="Outsourced tests" tone="#0a6ea0">
        <SidebarLink
          href="/outsource"
          label="Awaiting your result"
          icon={ClipboardList}
          badge={pending}
          exact
        />
        <SidebarLink
          href="/outsource/submitted"
          label="Submitted"
          icon={CheckCircle2}
        />
      </SidebarSection>
    </SidebarShell>
  );
}
