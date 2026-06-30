"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Polls the server component tree on an interval via router.refresh(), giving the
// Activity Log a near-real-time feed without a full page reload or websockets.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  const [last, setLast] = useState<string>("");

  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      router.refresh();
      setLast(new Date().toLocaleTimeString());
    }, intervalMs);
    return () => clearInterval(t);
  }, [on, intervalMs, router]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
      title="Toggle live updates"
    >
      <span
        className={`size-2 rounded-full ${on ? "animate-pulse bg-green-500" : "bg-muted-foreground/40"}`}
      />
      {on ? `Live · every ${Math.round(intervalMs / 1000)}s` : "Paused"}
      {on && last && <span className="opacity-60">({last})</span>}
    </button>
  );
}
