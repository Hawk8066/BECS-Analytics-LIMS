"use client";

import { Fragment, useMemo, useState } from "react";
import { updateParameterSectorPrice } from "@/lib/actions/parameters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PriceParam {
  id: string;
  name: string;
  unit: string | null;
  matrix: string | null;
}

export function SectorPrices({
  sectors,
  parameters,
  prices,
  canManage,
}: {
  sectors: string[];
  parameters: PriceParam[];
  // prices[parameterId][sector] = paisa
  prices: Record<string, Record<string, number>>;
  canManage: boolean;
}) {
  const [sector, setSector] = useState(sectors[0] ?? "");

  const rupees = (pid: string) => {
    const paisa = prices[pid]?.[sector];
    return paisa != null ? paisa / 100 : "";
  };

  // Group parameters by matrix.
  const groups = useMemo(() => {
    const m = new Map<string, PriceParam[]>();
    for (const p of [...parameters].sort(
      (a, b) =>
        (a.matrix ?? "~").localeCompare(b.matrix ?? "~") ||
        a.name.localeCompare(b.name),
    )) {
      const key = p.matrix || "— (no matrix)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return [...m.entries()];
  }, [parameters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="sector" className="text-sm">
          Sector
        </Label>
        <select
          id="sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Prices are set per sector.
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parameter</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Price for {sector} (PKR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([matrix, list]) => (
              <Fragment key={matrix}>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell colSpan={3} className="font-semibold">
                    {matrix}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({list.length})
                    </span>
                  </TableCell>
                </TableRow>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.unit || "—"}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <form
                          action={updateParameterSectorPrice}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="parameterId" value={p.id} />
                          <input type="hidden" name="sector" value={sector} />
                          <Input
                            key={sector}
                            name="price"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={rupees(p.id)}
                            className="h-8 w-32"
                            placeholder="—"
                          />
                          <Button size="sm" type="submit">
                            Save
                          </Button>
                        </form>
                      ) : (
                        <span>{rupees(p.id) === "" ? "—" : `PKR ${rupees(p.id)}`}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {parameters.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No parameters yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
