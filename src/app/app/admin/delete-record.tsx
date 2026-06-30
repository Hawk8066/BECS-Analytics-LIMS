"use client";

import { adminDeleteRecord } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function DeleteRecord({ modelName, id }: { modelName: string; id: string }) {
  return (
    <form
      action={adminDeleteRecord}
      onSubmit={(e) => {
        if (!confirm(`Delete this ${modelName} record? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="__model" value={modelName} />
      <input type="hidden" name="__id" value={id} />
      <Button type="submit" variant="destructive" size="sm">
        Delete
      </Button>
    </form>
  );
}
