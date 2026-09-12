"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RepairForm } from "./repair-form";
import type { VendorOption } from "../calibrator-select";

/**
 * "Request repair" popup. The form redirects to the new case file on success,
 * so the modal never has to close itself.
 */
export function RequestRepairButton({
  equipmentId,
  vendors,
}: {
  equipmentId: string;
  vendors: VendorOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Request repair
      </Button>
      {open && (
        <Modal
          title="Request repair"
          onClose={() => setOpen(false)}
          className="max-w-xl"
        >
          <RepairForm equipmentId={equipmentId} vendors={vendors} />
        </Modal>
      )}
    </>
  );
}
