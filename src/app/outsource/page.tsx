import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { limitText } from "@/lib/conformity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutsourceResultForm } from "./result-form";

export default async function OutsourcePortalPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "OUTSOURCE_LAB" || !user.outsourceLabId)
    redirect("/app");

  // Blinded: select ONLY the coded Lab ID + sample type + parameter. Never the
  // client, client ref, third-party name, instructions, or standard name.
  const select = {
    id: true,
    unit: true,
    limitMin: true,
    limitMax: true,
    resultValue: true,
    conformity: true,
    registerNo: true,
    enteredAt: true,
    parameter: { select: { name: true, unit: true } },
    sample: { select: { labId: true, sampleType: true } },
  } as const;

  const [pending, completed] = await Promise.all([
    // Awaiting our result — only while the sample is open for entry.
    prisma.sampleParameter.findMany({
      where: {
        outsourceLabId: user.outsourceLabId,
        resultValue: null,
        sample: { status: "ASSIGNED" },
      },
      select,
      orderBy: { createdAt: "asc" },
    }),
    // Already submitted (kept visible after the sample advances).
    prisma.sampleParameter.findMany({
      where: {
        outsourceLabId: user.outsourceLabId,
        resultValue: { not: null },
      },
      select,
      orderBy: { enteredAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Outsourced tests</h1>
        <p className="text-sm text-muted-foreground">
          Enter results for the parameters subcontracted to your lab. Samples are
          identified by a coded Lab ID.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Awaiting your result ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            pending.map((sp) => {
              const limit = limitText(sp.limitMin, sp.limitMax, sp.unit || sp.parameter.unit);
              return (
                <div key={sp.id} className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-mono">{sp.sample.labId}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{sp.sample.sampleType}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-medium">
                      {sp.parameter.name}
                      {(sp.unit || sp.parameter.unit) && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({sp.unit || sp.parameter.unit})
                        </span>
                      )}
                    </span>
                    {limit && (
                      <span className="text-xs text-muted-foreground">
                        acceptance {limit}
                      </span>
                    )}
                  </div>
                  <OutsourceResultForm sampleParameterId={sp.id} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submitted ({completed.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab ID</TableHead>
                  <TableHead>Parameter</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Report #</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.map((sp) => (
                  <TableRow key={sp.id}>
                    <TableCell className="font-mono text-xs">
                      {sp.sample.labId}
                    </TableCell>
                    <TableCell>
                      {sp.parameter.name}
                      {(sp.unit || sp.parameter.unit) && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({sp.unit || sp.parameter.unit})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{sp.resultValue}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sp.registerNo ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sp.enteredAt ? formatDateTime(sp.enteredAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
