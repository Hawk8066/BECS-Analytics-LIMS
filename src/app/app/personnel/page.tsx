import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { canManagePersonnel } from "@/lib/auth/perms";
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
  ACTIVE: "default",
  PENDING_PROFILE: "secondary",
  PENDING_APPROVAL: "outline",
  NON_ACTIVE: "destructive",
};

export default async function PersonnelListPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const people = await prisma.user.findMany({
    where: readScope(user),
    include: { profile: true, facility: true, section: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Personnel</h1>
          <p className="text-sm text-muted-foreground">
            {people.length} {people.length === 1 ? "person" : "people"}
            {user.canReadCrossSection ? " (all sections)" : " (your section)"}
          </p>
        </div>
        {canManagePersonnel(user.designation) && (
          <Link href="/app/personnel/new" className={buttonVariants()}>
            New personnel
          </Link>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Facility / Section</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/app/personnel/${p.id}`}
                    className="hover:underline"
                  >
                    {p.profile?.fullName ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>{p.designation}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.facility.code} / {p.section.name}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                    {p.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {people.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No personnel in scope.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
