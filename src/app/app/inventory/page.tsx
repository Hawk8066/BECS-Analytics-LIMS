import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageStore } from "@/lib/auth/perms";
import { decideIssue, requestIssue } from "@/lib/actions/receiving";
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

const ISSUE_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default async function InventoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const [stores, balancesRaw, issues] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.stockTransaction.groupBy({
      by: ["storeId", "description"],
      _sum: { quantity: true },
    }),
    prisma.issueRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const subStores = stores.filter((s) => s.type === "SUB");
  const balances = balancesRaw.filter((b) => (b._sum.quantity ?? 0) !== 0);
  const canDecide = canManageStore(user.designation);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stores &amp; Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock enters the main store via GRN, then moves to sub-stores by issue
          request (BR-10/11).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock balances</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b, i) => (
                <TableRow key={i}>
                  <TableCell>{storeName.get(b.storeId) ?? "—"}</TableCell>
                  <TableCell>{b.description}</TableCell>
                  <TableCell className="text-right">{b._sum.quantity}</TableCell>
                </TableRow>
              ))}
              {balances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No stock yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={requestIssue}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">To sub-store</label>
              <select
                name="toStoreId"
                required
                defaultValue=""
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="" disabled>
                  Select…
                </option>
                {subStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Item</label>
              <input
                name="description"
                required
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Qty</label>
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
                className="h-9 w-20 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <Button size="sm" type="submit">
              Request issue
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {storeName.get(r.toStoreId) ?? "—"}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={ISSUE_VARIANT[r.status] ?? "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "PENDING" && canDecide && (
                      <form action={decideIssue} className="flex justify-end gap-2">
                        <input type="hidden" name="issueId" value={r.id} />
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
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No issue requests.
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
