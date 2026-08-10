"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ThirdPartyForm } from "./third-party-form";

/**
 * "New third party" as a popup. Opens the third-party form in a modal; on a
 * successful save the action revalidates the list and the modal closes.
 */
export function ThirdPartyFormButton({
  clients,
}: {
  clients: { id: string; label: string; sector: string | null }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New third party</Button>
      {open && (
        <Modal
          title="New third party"
          onClose={() => setOpen(false)}
          className="max-w-2xl"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            An entity a client asks the report to be issued in the name of.
          </p>
          <ThirdPartyForm clients={clients} onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
