"use client";

import { Building2, FlaskConical } from "lucide-react";
import {
  SidebarShell,
  SidebarSection,
  SidebarLink,
} from "@/components/sidebar-shell";

/** Client portal navigation — the same shell the staff app uses. */
export function ClientSidebar({ samples }: { samples: number }) {
  return (
    <SidebarShell storageKey="becs.portal.nav.rail">
      <SidebarSection title="Client portal" tone="#0e3a5c">
        <SidebarLink
          href="/portal"
          label="My samples"
          icon={FlaskConical}
          badge={samples}
          exact
        />
        <SidebarLink href="/portal/profile" label="My details" icon={Building2} />
      </SidebarSection>
    </SidebarShell>
  );
}
