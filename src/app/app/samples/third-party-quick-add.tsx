"use client";

import { useState } from "react";
import { createThirdParty } from "@/lib/actions/third-parties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

/**
 * "+ New" third party, opened from the booking form. Uses controlled inputs and
 * calls the server action directly (no nested <form>, so it stays valid inside
 * the sample form), then hands the created id/label back to be selected.
 */
export function ThirdPartyQuickAdd({
  onCreated,
}: {
  onCreated: (id: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    company: "",
    addressLine1: "",
    city: "",
    contactNumber: "",
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    if (f.company.trim().length < 2) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("company", f.company);
    fd.set("addressLine1", f.addressLine1);
    fd.set("city", f.city);
    fd.set("contactNumber", f.contactNumber);
    const res = await createThirdParty({}, fd);
    setPending(false);
    if (res.error || !res.id) {
      setError(res.error ?? "Could not save.");
      return;
    }
    onCreated(res.id, res.label ?? f.company);
    setF({ company: "", addressLine1: "", city: "", contactNumber: "" });
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        + New
      </Button>
      {open && (
        <Modal
          title="New third party"
          onClose={() => setOpen(false)}
          className="max-w-md"
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Name</Label>
              <Input value={f.company} onChange={set("company")} />
            </div>
            <div className="grid gap-1">
              <Label>Address</Label>
              <Input value={f.addressLine1} onChange={set("addressLine1")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>City</Label>
                <Input value={f.city} onChange={set("city")} />
              </div>
              <div className="grid gap-1">
                <Label>Contact number</Label>
                <Input value={f.contactNumber} onChange={set("contactNumber")} />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save & select"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Saved to Third Parties — add full address/NTN there later.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
