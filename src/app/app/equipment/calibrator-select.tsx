"use client";

import { Label } from "@/components/ui/label";

export type VendorOption = { id: string; company: string };

/**
 * Who calibrated the instrument: a registered vendor, or the lab itself. Posts
 * a vendor id (or the "INTERNAL" sentinel) so the record links to the vendor
 * rather than repeating a typed name.
 */
export function CalibratorSelect({
  vendors,
  id = "calibratedBy",
  labelClassName,
}: {
  vendors: VendorOption[];
  id?: string;
  labelClassName?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={labelClassName}>
        Calibrated by
      </Label>
      <select
        id={id}
        name="calibratedBy"
        defaultValue=""
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Select…</option>
        <option value="INTERNAL">Internal (in-house)</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.company}
          </option>
        ))}
      </select>
      {vendors.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No vendors registered yet — add one under Vendors to pick it here.
        </p>
      )}
    </div>
  );
}
