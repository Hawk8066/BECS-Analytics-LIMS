"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParameterForm } from "./parameter-form";

export function AddParameter() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add parameter</Button>;
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Add parameter</CardTitle>
          <p className="text-xs text-muted-foreground">
            OM, Liaison Officer and RYK Lab Manager can propose; the COO approves.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent>
        <ParameterForm onDone={() => setOpen(false)} />
      </CardContent>
    </Card>
  );
}
