import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterVendor } from "@/lib/auth/perms";
import { buttonVariants } from "@/components/ui/button";
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

  const vendors = await prisma.vendor.findMany({ orderBy: { createdAt: "desc" } });

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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor No</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>NTN</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.vendorNo}</TableCell>
                <TableCell className="font-medium">{v.company}</TableCell>
                <TableCell className="text-muted-foreground">
                  {v.fields.join(", ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{v.ntn || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {v.contactNumber || "—"}
                </TableCell>
              </TableRow>
            ))}
            {vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
