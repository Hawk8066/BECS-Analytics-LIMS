"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CalibrationForm } from "./calibration-form";
import type { VendorOption } from "../calibrator-select";

/** "Add calibration" popup; the form closes it once the server confirms. */
export function AddCalibrationButton({
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
        Add calibration
      </Button>
      {open && (
        <Modal
          title="Add calibration"
          onClose={() => setOpen(false)}
          className="max-w-lg"
        >
          <CalibrationForm
            equipmentId={equipmentId}
            vendors={vendors}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
