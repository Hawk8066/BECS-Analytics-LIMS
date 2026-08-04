"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight modal: a backdrop + centered card. Escape and a backdrop click
 * close it. Not a full focus-trap — enough for short inline forms without
 * pulling in a dialog dependency.
 */
export function Modal({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
