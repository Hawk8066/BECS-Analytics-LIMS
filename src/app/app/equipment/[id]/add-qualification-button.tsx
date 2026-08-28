"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { QualificationForm } from "./qualification-form";

/** "Add qualification" popup; the form closes it once the server confirms. */
export function AddQualificationButton({
  equipmentId,
  repairId,
}: {
  equipmentId: string;
  /** Set on a repair case file, so the record is the repair's requalification. */
  repairId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add qualification
      </Button>
      {open && (
        <Modal
          title="Add qualification"
          onClose={() => setOpen(false)}
          className="max-w-lg"
        >
          <p className="text-sm text-muted-foreground">
            Qualification runs in order: IQ, then OQ, then PQ.
            {repairId
              ? " This repair is requalified from scratch — the order starts again."
              : ""}
          </p>
          <QualificationForm
            equipmentId={equipmentId}
            repairId={repairId}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
