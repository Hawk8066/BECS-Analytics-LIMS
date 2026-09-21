import { formatDateTime } from "@/lib/format";
import { requireOutsourceLab, submittedTests } from "@/lib/portal/outsource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function OutsourceSubmittedPage() {
  const { labId } = await requireOutsourceLab();
  const completed = await submittedTests(labId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Submitted</h1>
        <p className="text-sm text-muted-foreground">
          Results you have already returned. Kept visible after the sample moves
          on, so you keep a record of what was reported.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {completed.length} result{completed.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
