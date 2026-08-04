"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PaymentForm } from "./payment-form";

/** "Record payment" as a popup. The form closes itself once the payment posts. */
export function RecordPaymentButton({
  invoiceId,
  balance,
}: {
  invoiceId: string;
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
          <PaymentForm
            invoiceId={invoiceId}
            balance={balance}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
