"use client";

import { useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Collapsed section titles, so a fold survives reloads and re-logins. Kept in
// a tiny store rather than component state: every section reads the same list,
// and useSyncExternalStore lets the server render "all expanded" without a
// hydration mismatch.
const STORAGE_KEY = "becs.nav.collapsed";
const EMPTY = "[]";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Fold in one tab, folded in the rest.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Returns the raw JSON string: equal strings are Object.is-equal, so React
// only re-renders when the stored list actually changes.
function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function setCollapsed(titles: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
  } catch {
    // Private mode / storage disabled — the fold just won't persist.
  }
  listeners.forEach((l) => l());
}

/**
 * One colour-coded sidebar section whose links fold away when the heading is
 * clicked.
 */
export function NavSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  const collapsed = parse(
    useSyncExternalStore(subscribe, getSnapshot, () => EMPTY),
  );
  const open = !collapsed.includes(title);

  function toggle() {
    setCollapsed(
      open ? [...collapsed, title] : collapsed.filter((t) => t !== title),
    );
  }

  return (
    <div className="mb-3 flex flex-col">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mb-1.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-80"
        style={{ backgroundColor: `${tone}14`, color: tone }}
      >
        <span
          aria-hidden
          className="h-3.5 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />
        <span className="min-w-0 flex-1 text-left">{title}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {/* Coloured rail ties every link back to its section heading. */}
      {open && (
        <div
          className="ml-3 flex flex-col gap-0.5 border-l-2 pl-1.5"
          style={{ borderColor: `${tone}33` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
