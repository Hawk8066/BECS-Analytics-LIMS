"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { InspectForm } from "./inspect-form";

/** Accept or reject the returned work (BR-11). Rejecting reopens the case. */
export function InspectRepairButton({ repairId }: { repairId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Inspect repair
      </Button>
      {open && (
        <Modal
          title="Inspect repair"
          onClose={() => setOpen(false)}
          className="max-w-md"
        >
          <InspectForm repairId={repairId} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
