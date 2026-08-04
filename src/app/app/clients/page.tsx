import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient } from "@/lib/auth/perms";
import { formatDate } from "@/lib/format";
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

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const clients = await prisma.client.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} registered</p>
        </div>
        {canRegisterClient(user.designation) && (
          <Link href="/app/clients/new" className={buttonVariants()}>
            Register client
          </Link>
        )}
      </div>

      <ImportExcel model="Client" path="/app/clients" label="clients" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client No</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Contact person</TableHead>
              <TableHead>Contact number</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NTN</TableHead>
              <TableHead>STN</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.clientNo}</TableCell>
                <TableCell className="font-medium">{c.company}</TableCell>
                <TableCell className="text-muted-foreground">{c.sector ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.contactPerson ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.contactNumber ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.ntn ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.stn ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(c.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No clients yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
