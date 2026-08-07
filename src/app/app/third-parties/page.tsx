import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient } from "@/lib/auth/perms";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ThirdPartiesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const thirdParties = await prisma.thirdParty.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    orderBy: { company: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Third Parties</h1>
          <p className="text-sm text-muted-foreground">
            {thirdParties.length} saved · report can be issued in their name
          </p>
        </div>
        {canRegisterClient(user.designation) && (
          <Link href="/app/third-parties/new" className={buttonVariants()}>
            New third party
          </Link>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact person</TableHead>
              <TableHead>Contact number</TableHead>
              <TableHead>NTN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {thirdParties.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/app/third-parties/${t.id}`}
                    className="hover:underline"
                  >
                    {t.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/app/third-parties/${t.id}`}
                    className="hover:underline"
                  >
                    {t.company}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.city ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.contactPerson ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.contactNumber ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.ntn ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {thirdParties.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No third parties yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
