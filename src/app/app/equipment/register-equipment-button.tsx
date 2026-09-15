"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EquipmentForm, type EquipmentItem } from "./equipment-form";
import type { VendorOption } from "./calibrator-select";

/**
 * "Register equipment" popup for a lab's register. The form itself redirects to
 * the new asset on success, so the modal never has to close itself.
 */
export function RegisterEquipmentButton({
  items,
  vendors,
  storeHref,
  multipleStores,
  hasSubStore,
  labName,
}: {
  items: EquipmentItem[];
  vendors: VendorOption[];
  storeHref: string;
  multipleStores: boolean;
  hasSubStore: boolean;
  labName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Register equipment</Button>
      {open && (
        <Modal
          title={`Register equipment — ${labName}`}
          onClose={() => setOpen(false)}
          className="max-w-xl"
        >
          <p className="text-sm text-muted-foreground">
            Pick the equipment issued to this lab&rsquo;s sub-store, give the
            location in the lab where it stands, and enter its calibration dates.
            An asset tag is assigned automatically.
          </p>
          {hasSubStore ? (
            <EquipmentForm
              items={items}
              vendors={vendors}
              storeHref={storeHref}
              multipleStores={multipleStores}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {labName} has no sub-store yet — equipment is registered once it
              has been issued from the main store to a lab sub-store.{" "}
              <Link href="/app/inventory" className="underline">
                Stores &amp; Inventory
              </Link>
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
