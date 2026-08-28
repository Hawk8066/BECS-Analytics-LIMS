import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function InventoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  // Main store first, then the facility stores by name.
  const stores = await prisma.store.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stores &amp; Inventory</h1>
        <p className="text-sm text-muted-foreground">{stores.length} stores</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <Link
            key={s.id}
            href={`/app/inventory/${s.id}`}
            className="block rounded-xl transition-colors hover:bg-muted/40"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {s.name}
                  <Badge variant={s.type === "MAIN" ? "default" : "secondary"}>
                    {s.type === "MAIN" ? "Main store" : "Store"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {s._count.items} item{s._count.items === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
