"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

// Shared client state for the notification bell and the news reel. One poll
// feeds both surfaces, so opening the bell costs nothing extra.
//
// Transport deliberately lives behind this one hook: swapping the interval for
// Server-Sent Events later touches only this file.

export interface FeedItem {
  id: string;
  kind: string;
  text: string;
  href: string;
  at: string;
  actor: string | null;
  readAt?: string | null;
}
export interface TaskItem {
  key: string;
  text: string;
  href: string;
  count: number;
}
export interface Snapshot {
  unread: number;
  inbox: FeedItem[];
  tasks: TaskItem[];
  reel: FeedItem[];
  watermark: string;
}

interface FeedContext {
  snap: Snapshot;
  refresh: () => void;
  /** Optimistically clear unread so the badge reacts instantly. */
  clearUnread: () => void;
}

const Ctx = createContext<FeedContext | null>(null);

export function useFeed(): FeedContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFeed must be used inside <FeedProvider>");
  return ctx;
}

const BASE_MS = 30_000;
const MAX_MS = 120_000;
/** ±15% so a roomful of tabs doesn't align into a thundering herd. */
const jitter = (ms: number) => Math.round(ms * (0.85 + Math.random() * 0.3));

export function FeedProvider({
  initial,
  children,
}: {
  initial: Snapshot;
  children: React.ReactNode;
}) {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const etag = useRef<string | null>(null);
  const delay = useRef(BASE_MS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", {
        headers: etag.current ? { "If-None-Match": etag.current } : undefined,
        cache: "no-store",
      });
      if (res.status === 304) {
        // Nothing changed — back off so a quiet lab stops asking so often.
        delay.current = Math.min(Math.round(delay.current * 1.5), MAX_MS);
        return;
      }
      if (!res.ok) return;
      etag.current = res.headers.get("ETag");
      setSnap((await res.json()) as Snapshot);
      delay.current = BASE_MS; // real change: return to the fast cadence
    } catch {
      // Offline or a blip — keep the last snapshot and try again later.
    }
  }, []);

  // Self-scheduling loop (not setInterval) so the delay can change, and paused
  // entirely while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!document.hidden) await fetchOnce();
      if (cancelled) return;
      timer.current = setTimeout(tick, jitter(delay.current));
    };
    timer.current = setTimeout(tick, jitter(delay.current));

    const onVisible = () => {
      if (document.hidden) return;
      delay.current = BASE_MS;
      void fetchOnce();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchOnce]);

  // Navigating usually follows an action the user just took, so refresh at once —
  // this is what makes their own changes feel immediate.
  useEffect(() => {
    delay.current = BASE_MS;
    void fetchOnce();
  }, [pathname, fetchOnce]);

  const clearUnread = useCallback(
    () => setSnap((s) => ({ ...s, unread: 0 })),
    [],
  );

  return (
    <Ctx.Provider value={{ snap, refresh: fetchOnce, clearUnread }}>
      {children}
    </Ctx.Provider>
  );
}
