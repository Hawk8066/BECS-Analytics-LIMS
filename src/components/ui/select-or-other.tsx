"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A dropdown that also allows a free-typed "Other" value. Submits the resolved
// value under `name` (via a hidden input), so server actions read it plainly.
export function SelectOrOther({
  name,
  label,
  options,
  defaultValue = "",
  placeholder = "Select…",
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const known = defaultValue && !options.includes(defaultValue) ? false : true;
  const [sel, setSel] = useState(known ? defaultValue : "__other__");
  const [other, setOther] = useState(known ? "" : defaultValue);
  const isOther = sel === "__other__";
  const value = isOther ? other : sel;

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${name}__sel`}>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <select
        id={`${name}__sel`}
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className="h-9 rounded-md border bg-transparent px-2 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__other__">Other</option>
      </select>
      {isOther && (
        <Input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder={`Specify ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
}
