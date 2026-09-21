"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { NavSection } from "@/components/nav-section";
import { cn } from "@/lib/utils";

/**
 * Whether the rail is collapsed, in localStorage so it survives navigation and
 * reloads.
 *
 * Same shape as the section-fold store in `components/nav-section.tsx`, and for
 * the same reason: `useSyncExternalStore` lets the server render the expanded
 * state without a hydration mismatch, which plain `useState` + `useEffect`
 * would produce as a visible flash on every page load.
 */
const STORAGE_KEY = "becs.btfqc.nav.rail";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Collapse in one tab, collapsed in the rest.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "0";
  } catch {
    return "0";
  }
}

function setRail(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode / storage disabled — it just won't persist.
  }
  listeners.forEach((l) => l());
}

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const WORK: Item[] = [
  { href: "/btf-qc", label: "Lots", icon: Boxes, exact: true },
  { href: "/btf-qc/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/btf-qc/reports", label: "Monthly reports", icon: FileText },
];
const PERFORMANCE: Item = {
  href: "/btf-qc/performance",
  label: "Performance",
  icon: TrendingUp,
};
const SETTINGS: Item = {
  href: "/btf-qc/settings",
  label: "Settings",
  icon: Settings,
};

function useIsActive() {
  const pathname = usePathname();
  return (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function QcSidebar({
  canManage,
  isAdmin,
}: {
  canManage: boolean;
  isAdmin: boolean;
}) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => "0") === "1";
  const isActive = useIsActive();

  const work = canManage ? [...WORK, PERFORMANCE] : WORK;

  const link = (item: Item) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        // The label is the accessible name when expanded; collapsed, the icon
        // is the only visible content, so it needs one of its own.
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center rounded-md text-sm transition-colors",
          collapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col gap-1 overflow-y-auto border-r bg-muted/30 p-2 transition-[width] duration-200 print:hidden",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <button
        type="button"
        onClick={() => setRail(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mb-2 flex items-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          collapsed ? "justify-center" : "justify-end",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen aria-hidden className="size-4" />
        ) : (
          <PanelLeftClose aria-hidden className="size-4" />
        )}
      </button>

      {collapsed ? (
        // No section headings on the rail — there is no room for them, and the
        // fold they control would have nothing to reveal.
        <div className="flex flex-col gap-1">
          {work.map(link)}
          {isAdmin && link(SETTINGS)}
        </div>
      ) : (
        <>
          <NavSection title="Production QC" tone="#3d7a20">
            {work.map(link)}
          </NavSection>
          {isAdmin && (
            <NavSection title="Administration" tone="#7a3350">
              {link(SETTINGS)}
            </NavSection>
          )}
        </>
      )}
    </aside>
  );
}
