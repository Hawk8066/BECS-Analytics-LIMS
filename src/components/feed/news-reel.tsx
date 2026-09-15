"use client";

import { useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useFeed } from "./feed-provider";

/**
 * The running activity ticker. Shows only what this viewer's designation is
 * allowed to see — the server filters by capability audience and facility/section
 * before it ever reaches the client, and client identity is resolved per reader
 * (see src/lib/feed/render.ts).
 *
 * Accessibility, non-negotiable for a moving banner:
 *  - an explicit pause control and pause-on-hover/focus (WCAG 2.2.2 Pause/Stop/Hide);
 *  - `motion-reduce:animate-none` for users who ask for less motion;
 *  - the animated copies are aria-hidden and duplicated purely for a seamless
 *    loop; one static screen-reader list carries the real content.
 *
 * With nothing to show it renders nothing at all (not an empty bar), so the app
 * chrome doesn't shift for designations with no visible activity.
 */
export function NewsReel() {
  const { snap } = useFeed();
  const [paused, setPaused] = useState(false);

  if (snap.reel.length === 0) return null;

  const items = snap.reel;
  const strip = (key: string) => (
    <ul
      key={key}
      aria-hidden
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {items.map((i) => (
        <li key={`${key}-${i.id}`} className="flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-primary/60" />
          <Link
            href={i.href}
            className="whitespace-nowrap text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {i.text}
            {i.actor && (
              <span className="ml-1.5 opacity-70">— {i.actor}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-6 py-1.5 print:hidden">
      <div className="group relative min-w-0 flex-1 overflow-hidden">
        <div
          className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none"
          style={paused ? { animationPlayState: "paused" } : undefined}
        >
          {/* Two identical copies → the loop restarts seamlessly at -50%. */}
          {strip("a")}
          {strip("b")}
        </div>

        {/* The accessible, non-animated rendering of the same content. */}
        <ul className="sr-only">
          {items.map((i) => (
            <li key={`sr-${i.id}`}>
              <Link href={i.href}>{i.text}</Link>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Resume activity ticker" : "Pause activity ticker"}
        title={paused ? "Resume" : "Pause"}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>
    </div>
  );
}
