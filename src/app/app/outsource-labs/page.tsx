import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterOutsourceLab, canViewFinance } from "@/lib/auth/perms";
import { docBalance } from "@/lib/finance/summary";
import { Money } from "@/components/finance/money";
import { buttonVariants } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function OutsourceLabsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const showFinance = canViewFinance(user.designation);
  const labs = await prisma.outsourceLab.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      bills: { select: { amount: true, payments: { select: { amount: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Outsource Labs</h1>
          <p className="text-sm text-muted-foreground">
            {labs.length} registered · subcontractors for outsourced parameters
          </p>
        </div>
        {canRegisterOutsourceLab(user.designation) && (
          <Link href="/app/outsource-labs/new" className={buttonVariants()}>
            Register lab
          </Link>
        )}
      </div>

      <ImportExcel model="OutsourceLab" path="/app/outsource-labs" label="labs" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lab No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Focal person</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              {showFinance && (
                <TableHead className="text-right">Outstanding</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {labs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/app/outsource-labs/${l.id}`} className="hover:underline">
                    {l.labNo}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/app/outsource-labs/${l.id}`} className="hover:underline">
                    {l.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {l.contactPerson || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {l.contactNumber || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.email || "—"}</TableCell>
                {showFinance && (
                  <TableCell className="text-right">
                    <Money value={docBalance(l.bills).outstanding} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {labs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showFinance ? 6 : 5}
                  className="text-center text-muted-foreground"
                >
                  No outsource labs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
