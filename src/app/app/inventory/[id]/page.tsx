import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageStore } from "@/lib/auth/perms";
import { setThresholds } from "@/lib/actions/inventory";
import { decideIssue } from "@/lib/actions/receiving";
import {
  CATEGORY_LABEL,
  DEFAULT_REORDER_LEVEL,
  effectiveThreshold,
  stockLevel,
  stockStatusBadge,
} from "@/lib/inventory";
import { formatDate } from "@/lib/format";
import type { InitialRow } from "@/app/app/procurement/pr-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { AddItemButton } from "./add-item-button";
import { StoreActions } from "./store-actions";
import { InventoryTables, type InventoryRow } from "./inventory-tables";
import { SelectionProvider } from "./reorder-selection";

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const [store, catalogRaw, allStores, profile] = await Promise.all([
    prisma.store.findUnique({
      where: { id },
      include: {
        items: { orderBy: [{ category: "asc" }, { name: "asc" }] },
      },
    }),
    // Catalog for the pre-filled PR form's item picker (facility-wide).
    prisma.inventoryItem.findMany({
      where: { facilityId: user.facilityId },
      select: { name: true, category: true, pack: true, make: true, model: true },
      orderBy: { name: "asc" },
    }),
    // Destination stores for issue requests (issues come from the main store).
    prisma.store.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    // The current user's name, shown as the requester on the issue request.
    prisma.personnelProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true },
    }),
  ]);
  if (!store) notFound();

  const requesterName = profile?.fullName ?? user.email;

  const catalog = catalogRaw.map((it) => ({
    name: it.name,
    category: it.category,
    pack: it.pack ?? "",
    spec: [it.make, it.model].filter(Boolean).join(", "),
  }));

  // Issue requests move stock out of the main store, so destinations are the
  // other stores. Default to the store being viewed when it isn't the main one.
  const destinations = allStores
    .filter((s) => s.type !== "MAIN")
    .map((s) => ({ id: s.id, name: s.name }));
  const defaultToStoreId =
    store.type !== "MAIN"
      ? store.id
      : destinations[0]?.id;

  const isMain = store.type === "MAIN";
  const canManage = canManageStore(user.designation);
  const canAdd = isMain && canManage;
  const onThresholds = canManage && tab === "thresholds";
  const onIssues = isMain && canManage && tab === "issues";
  const onInventory = !onThresholds && !onIssues;

  // Sub-stores show the main store's on-hand for each item; a PR may only be
  // raised from a sub-store for items the main store can't supply (balance nil).
  const mainStore = allStores.find((s) => s.type === "MAIN");
  const mainBalances: Record<string, number> = {};
  if (!isMain && mainStore) {
    const mainItems = await prisma.inventoryItem.findMany({
      where: { storeId: mainStore.id },
      select: { name: true, quantity: true },
    });
    for (const m of mainItems) {
      const key = m.name.trim().toLowerCase();
      mainBalances[key] = (mainBalances[key] ?? 0) + (m.quantity ?? 0);
    }
  }

  // Issue requests relevant to this store: outgoing for the main store (it holds
  // the stock), incoming for a sub-store. Loaded only when that tab is open.
  let issues: IssueRow[] = [];
  if (onIssues) {
    const reqs = await prisma.issueRequest.findMany({
      where: isMain ? { fromStoreId: store.id } : { toStoreId: store.id },
      orderBy: { createdAt: "desc" },
    });
    const requesterIds = [...new Set(reqs.map((r) => r.requestedById))];
    const profiles = requesterIds.length
      ? await prisma.personnelProfile.findMany({
          where: { userId: { in: requesterIds } },
          select: { userId: true, fullName: true },
        })
      : [];
    const nameById = new Map(profiles.map((p) => [p.userId, p.fullName]));
    const storeNameById = new Map(allStores.map((s) => [s.id, s.name]));
    issues = reqs.map((r) => ({
      id: r.id,
      description: r.description,
      quantity: r.quantity,
      counterpart:
        (isMain
          ? storeNameById.get(r.toStoreId)
          : storeNameById.get(r.fromStoreId)) ?? "—",
      requestedBy: nameById.get(r.requestedById) ?? "—",
      createdAt: r.createdAt,
      status: r.status,
    }));
  }

  // Serializable rows for the (client) tables.
  const tableItems: InventoryRow[] = store.items.map((i) => ({
    id: i.id,
    category: i.category,
    name: i.name,
    pack: i.pack,
    unit: i.unit,
    specification: i.specification,
    accessories: i.accessories,
    make: i.make,
    quantity: i.quantity,
    reorderLevel: i.reorderLevel,
    expiryDate: i.expiryDate,
  }));

  // A pre-filled PR line for every item, keyed by id, so a selection of any
  // items can be turned into one requisition. Suggested quantity tops the
  // balance just past its reorder threshold.
  const rowData: Record<string, InitialRow> = {};
  for (const i of store.items) {
    const prSpec =
      i.specification ?? [i.make, i.model].filter(Boolean).join(", ");
    const topUp = Math.max(
      1,
      effectiveThreshold(i.reorderLevel) - (i.quantity ?? 0) + 1,
    );
    rowData[i.id] = {
      catKey: i.category,
      description: i.name,
      specification: prSpec || undefined,
      packSize: i.pack ?? undefined,
      unit: i.unit ?? undefined,
      quantity: String(topUp),
    };
  }

  const tabBase =
    "border-b-2 px-1 pb-2 text-sm font-medium transition-colors -mb-px";
  const activeTab = "border-primary text-foreground";
  const inactiveTab =
    "border-transparent text-muted-foreground hover:text-foreground";

  return (
    <SelectionProvider>
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/app/inventory"
              className="text-sm text-muted-foreground underline"
            >
              ← Stores
            </Link>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{store.name}</h1>
              <Badge variant={isMain ? "default" : "secondary"}>
                {isMain ? "Main store" : "Store"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {store.items.length} item{store.items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between border-b">
          <div className="flex gap-6">
            {canManage && (
              <>
                <Link
                  href={`/app/inventory/${store.id}`}
                  className={`${tabBase} ${onInventory ? activeTab : inactiveTab}`}
                >
                  Inventory
                </Link>
                <Link
                  href={`/app/inventory/${store.id}?tab=thresholds`}
                  className={`${tabBase} ${onThresholds ? activeTab : inactiveTab}`}
                >
                  Thresholds
                </Link>
                {isMain && (
                  <Link
                    href={`/app/inventory/${store.id}?tab=issues`}
                    className={`${tabBase} ${onIssues ? activeTab : inactiveTab}`}
                  >
                    Issue requests
                  </Link>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            {onInventory && store.items.length > 0 && (
              <StoreActions
                rowData={rowData}
                catalog={catalog}
                destinations={destinations}
                defaultToStoreId={defaultToStoreId}
                requesterName={requesterName}
                showIssue={isMain}
              />
            )}
            {canAdd && onInventory && <AddItemButton storeId={store.id} />}
          </div>
        </div>

        {onIssues ? (
          <IssueRequestsTab
            issues={issues}
            canDecide={isMain && canManage}
            counterpartLabel={isMain ? "To" : "From"}
          />
        ) : onThresholds ? (
          <ThresholdsTab store={store} />
        ) : store.items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {isMain
                ? "No items yet — use “Add item” to stock the main store."
                : "No items in this store yet — approved issue requests appear here."}
            </CardContent>
          </Card>
        ) : (
          <InventoryTables
            items={tableItems}
            mainBalances={mainBalances}
            isSub={!isMain}
          />
        )}
      </div>
    </SelectionProvider>
  );
}

type IssueRow = {
  id: string;
  description: string;
  quantity: number;
  counterpart: string;
  requestedBy: string;
  createdAt: Date;
  status: string;
};

function issueStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "APPROVED":
      return {
        label: "Approved",
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-destructive/10 text-destructive",
      };
    default:
      return {
        label: "Pending",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
      };
  }
}

// Issue requests tab. The main store's in-charge approves/rejects pending
// requests (approval moves the stock to the destination store); sub-stores see
// their incoming requests and status.
function IssueRequestsTab({
  issues,
  canDecide,
  counterpartLabel,
}: {
  issues: IssueRow[];
  canDecide: boolean;
  counterpartLabel: string;
}) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No issue requests yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issue requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>{counterpartLabel}</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                {canDecide && (
                  <TableHead className="text-right">Action</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((r) => {
                const badge = issueStatusBadge(r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.quantity}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.counterpart}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.requestedBy}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    {canDecide && (
                      <TableCell className="text-right">
                        {r.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <form action={decideIssue}>
                              <input
                                type="hidden"
                                name="issueId"
                                value={r.id}
                              />
                              <input
                                type="hidden"
                                name="decision"
                                value="APPROVED"
                              />
                              <Button type="submit" size="sm">
                                Approve
                              </Button>
                            </form>
                            <form action={decideIssue}>
                              <input
                                type="hidden"
                                name="issueId"
                                value={r.id}
                              />
                              <input
                                type="hidden"
                                name="decision"
                                value="REJECTED"
                              />
                              <Button type="submit" size="sm" variant="outline">
                                Reject
                              </Button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Thresholds tab: a single form to record/update the reorder level of every
// item in the store, saved together. Bulk-saved via setThresholds.
function ThresholdsTab({
  store,
}: {
  store: {
    id: string;
    items: {
      id: string;
      category: string;
      name: string;
      quantity: number | null;
      reorderLevel: number | null;
    }[];
  };
}) {
  if (store.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No items to set thresholds for yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={setThresholds}>
      <input type="hidden" name="storeId" value={store.id} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Reorder thresholds</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Flag an item for reorder at this on-hand level. Leave blank to use
              the default ({DEFAULT_REORDER_LEVEL}).
            </p>
          </div>
          <Button type="submit" size="sm">
            Save thresholds
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.items.map((i) => {
                  const status = stockStatusBadge(
                    stockLevel(i.quantity, i.reorderLevel),
                  );
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-muted-foreground">
                        {CATEGORY_LABEL[i.category] ?? i.category}
                      </TableCell>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.quantity ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          name={`t_${i.id}`}
                          type="number"
                          min="0"
                          defaultValue={i.reorderLevel ?? ""}
                          placeholder={String(DEFAULT_REORDER_LEVEL)}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
