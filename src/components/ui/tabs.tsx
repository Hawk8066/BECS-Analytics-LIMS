"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
  /** Optional small count/badge shown next to the label. */
  badge?: ReactNode;
}

// Lightweight tabs. All panels are server-rendered and passed in as `content`;
// this client wrapper only toggles which one is visible, so server-action forms
// inside the panels keep working.
export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: TabItem[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b">
        {tabs.map((t) => {
          const selected = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.key)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
                selected
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.badge != null && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tabs.map((t) => (
          <div key={t.key} role="tabpanel" hidden={active !== t.key}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
