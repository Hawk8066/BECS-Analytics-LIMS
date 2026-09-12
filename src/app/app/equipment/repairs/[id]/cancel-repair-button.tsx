"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CancelForm } from "./cancel-form";

/** Abandon a repair. The PR is left to be rejected through procurement. */
export function CancelRepairButton({ repairId }: { repairId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancel repair
      </Button>
      {open && (
        <Modal
          title="Cancel repair"
          onClose={() => setOpen(false)}
          className="max-w-md"
        >
          <CancelForm repairId={repairId} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
