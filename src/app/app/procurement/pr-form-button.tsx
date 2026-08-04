"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PRForm } from "./pr-form";

/**
 * "New PR" as a popup. Takes the same props as PRForm (loaded server-side) and
 * opens the requisition form in a modal. On submit the action redirects to the
 * new PR, which closes this.
 */
export function PRFormButton(props: ComponentProps<typeof PRForm>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New PR</Button>
      {open && (
        <Modal
          title="Raise Purchase Request"
          onClose={() => setOpen(false)}
          className="max-w-5xl"
        >
          <p className="mb-3 font-mono text-xs text-muted-foreground">
            BECS/FF/606/05 · Rev 02 · Issue 01
          </p>
          <PRForm {...props} />
        </Modal>
      )}
    </>
  );
}
