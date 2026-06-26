import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canApproveFunction, canManageFunctions } from "@/lib/auth/perms";
import { approveFunction } from "@/lib/actions/functions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function FunctionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const functions = await prisma.function.findMany({ orderBy: { code: "asc" } });
  const canApprove = canApproveFunction(user.designation);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Functions</h1>
          <p className="text-sm text-muted-foreground">
            Defined tasks that drive competence &amp; authorization (SSOT §6).
          </p>
        </div>
        {canManageFunctions(user.designation) && (
          <Link href="/app/functions/new" className={buttonVariants()}>
            New function
          </Link>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {functions.map((fn) => (
              <TableRow key={fn.id}>
                <TableCell className="font-mono text-xs">{fn.code}</TableCell>
                <TableCell>{fn.name}</TableCell>
                <TableCell>
                  {fn.approvedAt ? (
                    <Badge>Approved</Badge>
                  ) : (
                    <Badge variant="outline">Pending COO</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!fn.approvedAt && canApprove && (
                    <form action={approveFunction}>
                      <input type="hidden" name="functionId" value={fn.id} />
                      <Button size="sm" type="submit">
                        Approve
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {functions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No functions defined yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
