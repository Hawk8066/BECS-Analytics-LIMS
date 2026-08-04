"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LabPaymentForm } from "./lab-payment-form";

/** "Record payment" (to the lab) as a popup; the form closes itself on success. */
export function RecordLabPaymentButton({
  billId,
  balance,
}: {
  billId: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Record payment
      </Button>
      {open && (
        <Modal title="Record payment" onClose={() => setOpen(false)} className="max-w-md">
          <LabPaymentForm
            billId={billId}
            balance={balance}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
