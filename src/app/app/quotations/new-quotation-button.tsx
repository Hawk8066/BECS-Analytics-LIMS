"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { QuotationForm } from "./quotation-form";

/**
 * "New quotation" as a popup on the quotations list. Takes the same props as the
 * standalone page's form (loaded server-side via loadQuotationFormData). On
 * submit the form redirects to the new quotation, closing this.
 */
export function NewQuotationButton(props: ComponentProps<typeof QuotationForm>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New quotation</Button>
      {open && (
        <Modal title="New quotation" onClose={() => setOpen(false)} className="max-w-2xl">
          <QuotationForm {...props} />
        </Modal>
      )}
    </>
  );
}
