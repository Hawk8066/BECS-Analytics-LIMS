import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { procurementListWhere } from "@/lib/procurement/access";
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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SUBMITTED: "secondary",
  VERIFIED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default async function ProcurementPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const prs = await prisma.purchaseRequest.findMany({
    where: procurementListWhere(user),
    include: { lines: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Requests</h1>
          <p className="text-sm text-muted-foreground">{prs.length} in scope</p>
        </div>
        <Link href="/app/procurement/new" className={buttonVariants()}>
          New PR
        </Link>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PR No</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Raised</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prs.map((pr) => (
              <TableRow key={pr.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/app/procurement/${pr.id}`} className="hover:underline">
                    {pr.prNo}
                  </Link>
                </TableCell>
                <TableCell>{pr.lines.length}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[pr.status] ?? "secondary"}>
                    {pr.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(pr.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {prs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No purchase requests in scope.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
