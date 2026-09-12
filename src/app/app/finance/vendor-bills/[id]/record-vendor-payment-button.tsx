"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { VendorPaymentForm } from "./vendor-payment-form";

/** "Record payment" (to the vendor) as a popup; the form closes on success. */
export function RecordVendorPaymentButton({
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
          <VendorPaymentForm
            billId={billId}
            balance={balance}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
