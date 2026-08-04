import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageQuotations } from "@/lib/auth/perms";
import { loadQuotationFormData } from "./form-data";
import { NewQuotationButton } from "./new-quotation-button";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function pkr(paisa: number): string {
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline",
  SENT: "secondary",
  ACCEPTED: "default",
  REJECTED: "destructive",
};

export default async function QuotationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const canManage = canManageQuotations(user.designation);
  const quotations = await prisma.testQuotation.findMany({
    include: { client: { select: { company: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  // Only load the form's data when the New-quotation button will actually show.
  const formData = canManage ? await loadQuotationFormData(user) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            Client quotations for testing (priced from sector prices &amp; packages).
          </p>
        </div>
        {canManage && formData && <NewQuotationButton {...formData} />}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation No</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/app/quotations/${q.id}`} className="underline">
                    {q.quoteNo}
                  </Link>
                </TableCell>
                <TableCell>{q.client.company}</TableCell>
                <TableCell className="text-muted-foreground">{q.sector ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{q._count.items}</TableCell>
                <TableCell className="text-right">{pkr(q.total)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>{q.status}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(q.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {quotations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No quotations yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
