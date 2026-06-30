"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDate, maskDMY, dmyToISO } from "@/lib/format";

// A DD/MM/YYYY date field with BOTH free text entry AND a calendar picker.
// - The visible text input is masked to DD/MM/YYYY.
// - The calendar button opens the browser's native date picker (showPicker) via
//   an off-screen native date input; picking a date fills the masked field.
// - A hidden input carries the ISO (yyyy-mm-dd) value under `name`, so server
//   actions keep receiving ISO and need no changes.

export function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function DateInput({
  name,
  id,
  defaultValue,
  required,
}: {
  name: string;
  id?: string;
  /** ISO yyyy-mm-dd. */
  defaultValue?: string;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(formatDate(defaultValue));
  const iso = dmyToISO(display);
  const nativeRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through to focus/click fallback
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        autoComplete="off"
        className="pr-9"
        value={display}
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        aria-invalid={display.length > 0 && !iso ? true : undefined}
        onChange={(e) => setDisplay(maskDMY(e.target.value))}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <CalendarIcon />
      </button>
      {/* Off-screen native date input — used only to render the calendar popup. */}
      <input
        ref={nativeRef}
        type="date"
        value={iso}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => setDisplay(formatDate(e.target.value))}
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}
