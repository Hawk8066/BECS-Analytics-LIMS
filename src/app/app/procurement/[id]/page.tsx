import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canApprovePR, canVerifyPR } from "@/lib/auth/perms";
import {
  approvePR,
  rejectPR,
  verifyPR,
} from "@/lib/actions/purchase-requests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!pr) notFound();
  if (
    !user.canReadCrossSection &&
    (pr.facilityId !== user.facilityId || pr.sectionId !== user.sectionId)
  ) {
    notFound();
  }

  const requester = await prisma.user.findUnique({
    where: { id: pr.requestedById },
    include: { profile: { select: { fullName: true } } },
  });
  const canVerify = canVerifyPR(user.designation);
  const canApprove = canApprovePR(user.designation);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{pr.prNo}</h1>
          <p className="text-sm text-muted-foreground">
            Raised by {requester?.profile?.fullName ?? requester?.email ?? "—"}
          </p>
        </div>
        <Badge>{pr.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {pr.status === "SUBMITTED" && canVerify && (
            <>
              <form action={verifyPR}>
                <input type="hidden" name="prId" value={pr.id} />
                <Button type="submit">Verify</Button>
              </form>
              <form action={rejectPR}>
                <input type="hidden" name="prId" value={pr.id} />
                <Button type="submit" variant="outline">
                  Reject
                </Button>
              </form>
            </>
          )}
          {pr.status === "VERIFIED" && (
            <>
              {canApprove && (
                <form action={approvePR}>
                  <input type="hidden" name="prId" value={pr.id} />
                  <Button type="submit">Approve (COO)</Button>
                </form>
              )}
              {canVerify && (
                <form action={rejectPR}>
                  <input type="hidden" name="prId" value={pr.id} />
                  <Button type="submit" variant="outline">
                    Reject
                  </Button>
                </form>
              )}
            </>
          )}
          {pr.status === "SUBMITTED" && !canVerify && (
            <p className="text-sm text-muted-foreground">Awaiting verification.</p>
          )}
          {pr.status === "VERIFIED" && !canApprove && (
            <p className="text-sm text-muted-foreground">Awaiting COO approval.</p>
          )}
          {pr.status === "APPROVED" && (
            <p className="text-sm text-muted-foreground">
              Approved — quotations / PO / GRN in the next phase.
            </p>
          )}
          {pr.status === "REJECTED" && (
            <p className="text-sm text-red-600">This PR was rejected.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pr.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.category}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.path === "FULL" ? "default" : "secondary"}>
                      {l.path}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.quantity}
                    {l.unit ? ` ${l.unit}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pr.note && (
            <p className="text-sm text-muted-foreground">Note: {pr.note}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
