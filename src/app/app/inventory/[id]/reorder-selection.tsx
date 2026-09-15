"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Shared selection state for the row-ticking flows. A control turns selection
// mode on for a given purpose ("pr" → purchase requisition, "issue" → issue
// request), the tables render checkboxes and record ticked items, and the
// control reads the chosen ids back to build the request.
export type SelectionMode = "pr" | "issue";

type SelectionValue = {
  mode: SelectionMode | null;
  start: (mode: SelectionMode) => void;
  cancel: () => void;
  selected: Set<string>;
  toggle: (id: string) => void;
};

const SelectionContext = createContext<SelectionValue | null>(null);

export function useSelection(): SelectionValue {
  const ctx = useContext(SelectionContext);
  if (!ctx)
    throw new Error("useSelection must be used within a SelectionProvider");
  return ctx;
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SelectionMode | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const start = (m: SelectionMode) => setMode(m);
  const cancel = () => {
    setMode(null);
    setSelected(new Set());
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SelectionContext.Provider value={{ mode, start, cancel, selected, toggle }}>
      {children}
    </SelectionContext.Provider>
  );
}
