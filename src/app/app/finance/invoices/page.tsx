import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canIssueInvoice, canViewFinance } from "@/lib/auth/perms";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ISSUED: "secondary",
  PARTIAL: "outline",
  PAID: "default",
};

function pkr(paisa: number): string {
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canViewFinance(user.designation) && !canIssueInvoice(user.designation))
    redirect("/app");

  const invoices = await prisma.invoice.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    include: { client: { select: { company: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        {canIssueInvoice(user.designation) && (
          <Link href="/app/finance/invoices/new" className={buttonVariants()}>
            New invoice
          </Link>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/app/finance/invoices/${inv.id}`}
                    className="hover:underline"
                  >
                    {inv.invoiceNo}
                  </Link>
                </TableCell>
                <TableCell>{inv.client.company}</TableCell>
                <TableCell className="text-right">{pkr(inv.amount)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[inv.status] ?? "secondary"}>
                    {inv.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
