"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ParameterForm } from "./parameter-form";

export function AddParameter({
  matrices,
  units,
}: {
  /** Matrices already in use, so a new parameter files under an existing one. */
  matrices: string[];
  units: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New parameter</Button>
      {open && (
        <Modal title="New parameter" onClose={() => setOpen(false)} className="max-w-3xl">
          <p className="text-xs text-muted-foreground">
            OM, Liaison Officer and RYK Lab Manager can propose; the COO approves.
          </p>
          <ParameterForm
            matrices={matrices}
            units={units}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
