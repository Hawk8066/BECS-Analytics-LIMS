"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SampleForm } from "./sample-form";

/**
 * "Register sample" as a popup on the samples list. Takes the same props as the
 * standalone page's form (loaded server-side via loadSampleFormData) and opens
 * them in a modal. On submit the form redirects to the new sample, closing this.
 */
export function RegisterSampleButton({
  size,
  ...props
}: ComponentProps<typeof SampleForm> & { size?: ComponentProps<typeof Button>["size"] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        Register sample
      </Button>
      {open && (
        <Modal title="Register sample" onClose={() => setOpen(false)} className="max-w-3xl">
          <p className="text-xs text-muted-foreground">
            A coded Lab ID is assigned; the sample is blinded for testing.
          </p>
          <SampleForm {...props} />
        </Modal>
      )}
    </>
  );
}
