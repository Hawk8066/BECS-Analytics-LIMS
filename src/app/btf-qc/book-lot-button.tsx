"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BookLotForm } from "./book-lot-form";

/**
 * "Book new lot" as a popup. Takes the same props as BookLotForm and opens it in
 * a modal. On submit the action redirects to the new lot, which closes this.
 */
export function BookLotButton(props: ComponentProps<typeof BookLotForm>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Book new lot
      </Button>
      {open && (
        <Modal title="Book a new lot" onClose={() => setOpen(false)} className="max-w-2xl">
          <BookLotForm {...props} />
        </Modal>
      )}
    </>
  );
}
