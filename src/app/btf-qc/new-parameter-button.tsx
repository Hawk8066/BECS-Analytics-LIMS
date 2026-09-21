"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ParameterForm } from "@/app/app/parameters/parameter-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Add a catalogue parameter without leaving Production QC.
 *
 * Reuses the Parameters page's own form rather than duplicating it — the same
 * thing the quotation builder does. That matters because `createParameter`
 * also dates the opening price into ParameterPriceHistory; a second hand-rolled
 * form would be one refactor away from silently skipping it.
 *
 * `router.refresh()` rather than a new revalidatePath: `createParameter` only
 * revalidates /app/parameters, and it is shared by four other screens, so
 * refreshing from the caller avoids widening a shared action for one caller.
 */
export function NewParameterButton({
  matrices,
  units,
}: {
  matrices?: string[];
  units?: string[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        New parameter
      </Button>

      {open && (
        <Modal
          title="New parameter"
          onClose={() => setOpen(false)}
          className="max-w-3xl"
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Added to the shared Parameters catalogue, not just to QC. Created as
            an administrator, it is approved and usable immediately.
          </p>
          <ParameterForm
            matrices={matrices}
            units={units}
            onDone={() => {
              router.refresh();
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
