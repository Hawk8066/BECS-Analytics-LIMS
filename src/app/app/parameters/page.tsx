import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageParameters, canApproveParameter } from "@/lib/auth/perms";
import { approveParameter } from "@/lib/actions/parameters";
import { AddParameter } from "./add-parameter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function pkr(paisa: number | null): string {
  if (paisa == null) return "—";
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

export default async function ParametersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const parameters = await prisma.parameter.findMany({ orderBy: { name: "asc" } });
  const canManage = canManageParameters(user.designation);
  const canApprove = canApproveParameter(user.designation);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parameters &amp; Prices</h1>
        <p className="text-sm text-muted-foreground">
          Master list; proposals are approved by the COO before they can be used.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parameter</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Matrix</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>LOD</TableHead>
              <TableHead>LOQ</TableHead>
              <TableHead>Accredited</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              {canApprove && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.unit || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.matrix || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.method || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.lod || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.loq || "—"}</TableCell>
                <TableCell>
                  {p.accredited ? (
                    <Badge>Accredited</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.approvedAt ? (
                    <Badge>Approved</Badge>
                  ) : (
                    <Badge variant="outline">Pending COO</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{pkr(p.price)}</TableCell>
                {canApprove && (
                  <TableCell className="text-right">
                    {!p.approvedAt && (
                      <form action={approveParameter}>
                        <input type="hidden" name="parameterId" value={p.id} />
                        <Button size="sm" type="submit">
                          Approve
                        </Button>
                      </form>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {parameters.length === 0 && (
              <TableRow>
                <TableCell colSpan={canApprove ? 10 : 9} className="text-center text-muted-foreground">
                  No parameters yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canManage && <AddParameter />}
    </div>
  );
}
