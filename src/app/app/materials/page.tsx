import Link from "next/link";
import { redirect } from "next/navigation";
import { MaterialType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import { canManageMaterials } from "@/lib/auth/perms";
import { buttonVariants } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TABS: { type: MaterialType; label: string }[] = [
  { type: "CHEMICAL", label: "Chemicals" },
  { type: "CRM", label: "CRM" },
  { type: "GLASSWARE", label: "Glassware" },
  { type: "LAB_SUPPLY", label: "Lab Supplies" },
];

function d(date: Date): string {
  return formatDate(date);
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const sp = await searchParams;
  const valid = TABS.map((t) => t.type) as string[];
  const type = (valid.includes(sp.type ?? "") ? sp.type : "CHEMICAL") as MaterialType;

  const items = await prisma.materialItem.findMany({
    where: { ...readScope(user), type },
    orderBy: { createdAt: "desc" },
  });
  const isCRM = type === "CRM";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Materials</h1>
        {canManageMaterials(user.designation) && (
          <Link href={`/app/materials/new?type=${type}`} className={buttonVariants()}>
            New {TABS.find((t) => t.type === type)?.label}
          </Link>
        )}
      </div>

      <ImportExcel model="MaterialItem" path="/app/materials" label="materials" />

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.type}
            href={`/app/materials?type=${t.type}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              t.type === type
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Lot</TableHead>
              {isCRM && <TableHead>Certified value</TableHead>}
              <TableHead>Expiry</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link href={`/app/materials/${m.id}`} className="hover:underline">
                    {m.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.lotNo || "—"}
                </TableCell>
                {isCRM && (
                  <TableCell className="text-muted-foreground">
                    {m.certifiedValue || "—"}
                  </TableCell>
                )}
                <TableCell
                  className={
                    m.expiry && m.expiry < new Date()
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }
                >
                  {m.expiry ? d(m.expiry) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.unit || "—"}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={isCRM ? 5 : 4} className="text-center text-muted-foreground">
                  None registered.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
