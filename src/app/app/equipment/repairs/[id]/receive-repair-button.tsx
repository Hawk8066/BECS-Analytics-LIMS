"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ReceiveForm } from "./receive-form";

/** Take the asset back in — closes the gate pass it left on. */
export function ReceiveRepairButton({
  repairId,
  offSite,
}: {
  repairId: string;
  offSite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const title = offSite ? "Receive equipment back" : "Mark work completed";

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {title}
      </Button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)} className="max-w-md">
          <ReceiveForm
            repairId={repairId}
            offSite={offSite}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
