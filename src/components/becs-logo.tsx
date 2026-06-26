"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Renders the uploaded BECS Analytics logo from /public/becs-logo.png.
// If that file is missing, it falls back to the brand-colored atom SVG + wordmark
// so the UI never shows a broken image.
export function BecsLogo({
  size = 36,
  subtitle = "Analytics",
  className,
}: {
  size?: number;
  subtitle?: string;
  className?: string;
}) {
  const [useFallback, setUseFallback] = useState(false);

  if (!useFallback) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src="/becs-logo.png"
        alt="BECS Analytics"
        style={{ height: size * 1.1 }}
        className={cn("w-auto object-contain", className)}
        onError={() => setUseFallback(true)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/becs-mark.svg" alt="BECS Analytics" width={size} height={size} />
      <div className="leading-none">
        <div className="text-lg font-bold tracking-tight text-[#0e3a5c] dark:text-white">
          BECS
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1ca9e6]">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
