import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterOutsourceLab } from "@/lib/auth/perms";
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

  const labs = await prisma.outsourceLab.findMany({
    orderBy: { createdAt: "desc" },
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
              </TableRow>
            ))}
            {labs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
