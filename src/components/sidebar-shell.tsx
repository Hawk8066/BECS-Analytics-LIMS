"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { NavSection } from "@/components/nav-section";
import { cn } from "@/lib/utils";

/**
 * The sidebar shell shared by the main app and Production QC.
 *
 * Collapses two ways: vertically, per section, via `NavSection`; and
 * horizontally to an icon rail, handled here.
 *
 * The collapsed flag lives in localStorage and is read through
 * `useSyncExternalStore`, matching `NavSection`'s own store. That is not
 * incidental — `useState` + `useEffect` would render expanded on the server and
 * snap to the rail after hydration, a visible jump on every page load. Each
 * mount passes its own `storageKey`, so the app and QC remember separately.
 */

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

function read(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "0";
  } catch {
    return "0";
  }
}

function write(key: string, collapsed: boolean) {
  try {
    window.localStorage.setItem(key, collapsed ? "1" : "0");
  } catch {
    // Private mode / storage disabled — it just won't persist.
  }
  listeners.forEach((l) => l());
}

const CollapsedContext = createContext(false);

/** True when the sidebar is showing as an icon rail. */
export const useSidebarCollapsed = () => useContext(CollapsedContext);

export function SidebarShell({
  storageKey,
  brand,
  children,
}: {
  storageKey: string;
  /** Logo or title, hidden on the rail where there is no room for it. */
  brand?: React.ReactNode;
  /** Optional: the undertaking gate renders a sidebar with no navigation. */
  children?: React.ReactNode;
}) {
  const collapsed =
    useSyncExternalStore(
      subscribe,
      () => read(storageKey),
      () => "0",
    ) === "1";

  return (
    <CollapsedContext.Provider value={collapsed}>
      <aside
        className={cn(
          "flex shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r bg-muted/30 transition-[width] duration-200 print:hidden",
          collapsed ? "w-14 p-2" : "w-56 p-3",
        )}
      >
        <div
          className={cn(
            "mb-2 flex items-center gap-2",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && <div className="min-w-0 flex-1">{brand}</div>}
          <button
            type="button"
            onClick={() => write(storageKey, !collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4" />
            )}
          </button>
        </div>
        {children}
      </aside>
    </CollapsedContext.Provider>
  );
}

/**
 * A titled group of links. On the rail the heading is dropped: there is no room
 * for it, and the fold it controls would have nothing left to reveal.
 */
export function SidebarSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  const collapsed = useSidebarCollapsed();
  if (collapsed)
    return (
      <div className="mb-2 flex flex-col gap-1 border-b pb-2 last:border-b-0">
        {children}
      </div>
    );
  return (
    <NavSection title={title} tone={tone}>
      {children}
    </NavSection>
  );
}

export function SidebarLink({
  href,
  label,
  icon: Icon,
  exact,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match this path only — for landing pages whose siblings nest beneath it. */
  exact?: boolean;
  /** Outstanding count. Zero and undefined both render nothing. */
  badge?: number;
}) {
  const collapsed = useSidebarCollapsed();
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      // On the rail the icon is the only visible content, so the link needs an
      // accessible name of its own and a tooltip for sighted users.
      aria-label={
        collapsed ? (badge ? `${label} (${badge})` : label) : undefined
      }
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md text-sm transition-colors",
        collapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="relative shrink-0">
        <Icon aria-hidden className="size-4" />
        {/* On the rail there is no room for a number, so the count degrades to
            a dot. The label's aria-label already carries the meaning. */}
        {collapsed && !!badge && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-muted"
          />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {!!badge && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 text-xs tabular-nums",
                active ? "bg-primary-foreground/20" : "bg-muted-foreground/15",
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
