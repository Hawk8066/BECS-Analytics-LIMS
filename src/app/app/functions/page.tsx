import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canApproveFunction, canManageFunctions } from "@/lib/auth/perms";
import { approveFunction } from "@/lib/actions/functions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
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

      <ImportExcel model="Function" path="/app/functions" label="functions" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Requirements</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {functions.map((fn) => (
              <TableRow key={fn.id}>
                <TableCell className="align-top font-mono text-xs">{fn.code}</TableCell>
                <TableCell className="align-top">
                  <div className="max-w-[220px] break-words whitespace-normal">{fn.name}</div>
                </TableCell>
                <TableCell className="align-top text-xs text-muted-foreground">
                  {fn.requiredEducation.length === 0 &&
                  fn.requiredFields.length === 0 &&
                  fn.requiredTrainings.length === 0 &&
                  fn.minExperienceYears == null ? (
                    "—"
                  ) : (
                    <div className="max-w-[520px] space-y-0.5 break-words whitespace-normal">
                      {fn.requiredEducation.length > 0 && (
                        <div>Edu: {fn.requiredEducation.join(", ")}</div>
                      )}
                      {fn.requiredFields.length > 0 && (
                        <div>Subject: {fn.requiredFields.join(", ")}</div>
                      )}
                      {fn.requiredTrainings.length > 0 && (
                        <div>Training: {fn.requiredTrainings.join(", ")}</div>
                      )}
                      {fn.minExperienceYears != null && (
                        <div>Exp: ≥ {fn.minExperienceYears} yrs</div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {fn.approvedAt ? (
                    <Badge>Approved</Badge>
                  ) : (
                    <Badge variant="outline">Pending COO</Badge>
                  )}
                </TableCell>
                <TableCell className="align-top text-right">
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
