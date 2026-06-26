import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { canApproveLeave } from "@/lib/auth/perms";
import { decideLeave } from "@/lib/actions/leave";
import { LeaveForm } from "./leave-form";
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

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

function d(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function LeavePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const isApprover = canApproveLeave(user.designation);
  const [mine, pending] = await Promise.all([
    prisma.leaveApplication.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    isApprover
      ? prisma.leaveApplication.findMany({
          where: { ...readScope(user), status: "PENDING", NOT: { userId: user.id } },
          include: { user: { include: { profile: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="text-sm text-muted-foreground">
          Applications only — no quota tracking (BR-20).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apply for leave</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveForm />
        </CardContent>
      </Card>

      {isApprover && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.user.profile?.fullName ?? l.user.email}</TableCell>
                    <TableCell>{l.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d(l.fromDate)} → {d(l.toDate)}
                    </TableCell>
                    <TableCell>
                      <form action={decideLeave} className="flex justify-end gap-2">
                        <input type="hidden" name="leaveId" value={l.id} />
                        <Button size="sm" type="submit" name="decision" value="APPROVED">
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="submit"
                          name="decision"
                          value="REJECTED"
                        >
                          Reject
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d(l.fromDate)} → {d(l.toDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {mine.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No applications yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
