import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { checkIn, checkOut } from "@/lib/actions/attendance";
import { formatDate } from "@/lib/format";
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hm(d?: Date | null): string {
  return d ? d.toISOString().slice(11, 16) + " UTC" : "—";
}

export default async function AttendancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const date = startOfToday();
  const [today, onLeave, recent] = await Promise.all([
    prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date } },
    }),
    prisma.leaveApplication.findFirst({
      where: {
        userId: user.id,
        status: "APPROVED",
        fromDate: { lte: date },
        toDate: { gte: date },
      },
    }),
    prisma.attendance.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 14,
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          E-signed check-in / check-out (BR-20).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {onLeave ? (
            <Badge variant="secondary">On approved leave today</Badge>
          ) : !today?.checkIn ? (
            <form action={checkIn}>
              <Button type="submit">Check in</Button>
            </form>
          ) : !today.checkOut ? (
            <>
              <span className="text-sm text-muted-foreground">
                Checked in at {hm(today.checkIn)}
              </span>
              <form action={checkOut}>
                <Button type="submit">Check out</Button>
              </form>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Completed — in {hm(today.checkIn)}, out {hm(today.checkOut)}
            </span>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{formatDate(a.date)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{a.status}</Badge>
                </TableCell>
                <TableCell>{hm(a.checkIn)}</TableCell>
                <TableCell>{hm(a.checkOut)}</TableCell>
              </TableRow>
            ))}
            {recent.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No attendance recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
