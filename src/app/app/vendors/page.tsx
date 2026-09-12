import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterVendor, canViewFinance } from "@/lib/auth/perms";
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

export default async function VendorsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const showFinance = canViewFinance(user.designation);
  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      bills: { select: { amount: true, payments: { select: { amount: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendors</h1>
          <p className="text-sm text-muted-foreground">{vendors.length} registered</p>
        </div>
        {canRegisterVendor(user.designation) && (
          <Link href="/app/vendors/new" className={buttonVariants()}>
            Register vendor
          </Link>
        )}
      </div>

      <ImportExcel model="Vendor" path="/app/vendors" label="vendors" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor No</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>NTN</TableHead>
              <TableHead>Contact</TableHead>
              {showFinance && (
                <TableHead className="text-right">Outstanding</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/app/vendors/${v.id}`}
                    className="hover:underline"
                  >
                    {v.vendorNo}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/app/vendors/${v.id}`}
                    className="hover:underline"
                  >
                    {v.company}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.fields.join(", ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{v.ntn || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {v.contactNumber || "—"}
                </TableCell>
                {showFinance && (
                  <TableCell className="text-right">
                    <Money value={docBalance(v.bills).outstanding} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {vendors.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showFinance ? 6 : 5}
                  className="text-center text-muted-foreground"
                >
                  No vendors yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
