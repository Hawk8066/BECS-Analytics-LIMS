"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/feed";
import { useFeed } from "./feed-provider";

/**
 * Two tabs, deliberately:
 *   Tasks  — standing work derived live (self-clearing, never stale)
 *   Inbox  — discrete events with unread state
 *
 * The badge counts UNREAD INBOX ONLY. Summing in the task count would produce a
 * number that never reaches zero, which trains people to ignore the bell.
 */
export function NotificationBell() {
  const { snap, refresh, clearUnread } = useFeed();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"tasks" | "inbox">("tasks");
  const wrap = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const taskTotal = snap.tasks.reduce((s, t) => s + t.count, 0);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            setTab(snap.unread > 0 ? "inbox" : "tasks");
            void refresh(); // opening is an explicit "show me now"
          }
        }}
        aria-label={`Notifications${snap.unread ? ` (${snap.unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-4" />
        {snap.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-4 text-white">
            {snap.unread > 9 ? "9+" : snap.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-lg border bg-background shadow-lg">
          <div className="flex items-center gap-1 border-b px-2 pt-2">
            {(["tasks", "inbox"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "tasks" ? "Tasks" : "Inbox"}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {t === "tasks" ? taskTotal : snap.unread}
                </span>
              </button>
            ))}
            {tab === "inbox" && snap.unread > 0 && (
              <button
                type="button"
                onClick={async () => {
                  clearUnread();
                  await markAllNotificationsRead();
                  void refresh();
                }}
                className="ml-auto pb-2 pr-1 text-xs text-muted-foreground underline hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {tab === "tasks" ? (
              snap.tasks.length === 0 ? (
                <Empty>You&rsquo;re all caught up.</Empty>
              ) : (
                snap.tasks.map((t) => (
                  <Link
                    key={t.key}
                    href={t.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-0 hover:bg-muted/50"
                  >
                    <span>{t.text}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                      {t.count}
                    </span>
                  </Link>
                ))
              )
            ) : snap.inbox.length === 0 ? (
              <Empty>Nothing here yet.</Empty>
            ) : (
              snap.inbox.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={async () => {
                    setOpen(false);
                    if (!n.readAt) {
                      clearUnread();
                      await markNotificationRead(n.id);
                      void refresh();
                    }
                  }}
                  className={`block border-b px-3 py-2.5 text-sm last:border-0 hover:bg-muted/50 ${
                    n.readAt ? "" : "bg-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0">
                      <p>{n.text}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(n.at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
