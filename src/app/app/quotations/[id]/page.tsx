import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageQuotations } from "@/lib/auth/perms";
import { setQuotationStatus } from "@/lib/actions/quotations";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const { id } = await params;
  const q = await prisma.testQuotation.findUnique({
    where: { id },
    include: { client: true, items: true },
  });
  if (!q) notFound();
  const canManage = canManageQuotations(user.designation);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/quotations" className="underline">
              Quotations
            </Link>{" "}
            / {q.quoteNo}
          </p>
          <h1 className="text-2xl font-semibold">{q.quoteNo}</h1>
          <p className="text-sm text-muted-foreground">
            {q.client.company}
            {q.sector ? ` · ${q.sector}` : ""} · {formatDate(q.createdAt)}
          </p>
        </div>
        <Badge>{q.status}</Badge>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Quoted items</CardTitle>
          <div className="text-sm text-muted-foreground">
            {q.validUntil ? `Valid until ${formatDate(q.validUntil)}` : "No expiry"}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {it.kind === "PACKAGE" ? "Package" : "Parameter"}
                  </TableCell>
                  <TableCell className="text-right">{pkr(it.price)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={2} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">{pkr(q.subtotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {q.note && (
            <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
              {q.note}
            </p>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {(["SENT", "ACCEPTED", "REJECTED", "DRAFT"] as const)
            .filter((s) => s !== q.status)
            .map((s) => (
              <form key={s} action={setQuotationStatus}>
                <input type="hidden" name="quotationId" value={q.id} />
                <input type="hidden" name="status" value={s} />
                <Button size="sm" variant="outline" type="submit">
                  Mark {s.charAt(0) + s.slice(1).toLowerCase()}
                </Button>
              </form>
            ))}
        </div>
      )}
    </div>
  );
}
