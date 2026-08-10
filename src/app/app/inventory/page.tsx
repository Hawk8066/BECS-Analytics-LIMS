import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManageStore, isAdmin } from "@/lib/auth/perms";
import { isLabOnly } from "@/lib/inventory";
import { decideIssue, requestIssue } from "@/lib/actions/receiving";
import { setStockStatus } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
import { Badge } from "@/components/ui/badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
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

type Balance = { storeId: string; description: string; _sum: { quantity: number | null } };
type Issue = {
  id: string;
  description: string;
  toStoreId: string;
  quantity: number;
  status: string;
};
type StoreOpt = { id: string; name: string };
type RegisterItem = {
  id: string;
  category: string;
  code: string | null;
  name: string;
  pack: string | null;
  rack: string | null;
  make: string | null;
  model: string | null;
  parts: string | null;
  subCategory: string | null;
  quantity: number | null;
  lotNo: string | null;
  stockStatus: string;
};

const dash = (v: string | null) => v ?? "—";

// Current stock level + one-click reporting. Any user may report; management
// users get a read-only badge on the lab registers.
function StockCell({
  item,
  editable,
}: {
  item: RegisterItem;
  editable: boolean;
}): ReactNode {
  const badge =
    item.stockStatus === "END" ? (
      <Badge variant="destructive">Stock End</Badge>
    ) : item.stockStatus === "LOW" ? (
      <Badge variant="secondary">Stock Low</Badge>
    ) : (
      <Badge variant="outline">OK</Badge>
    );

  if (!editable) return badge;

  const opts = (
    [
      { v: "LOW", label: "Low" },
      { v: "END", label: "End" },
      { v: "OK", label: "OK" },
    ] as const
  ).filter((o) => o.v !== item.stockStatus);

  return (
    <form action={setStockStatus} className="flex items-center justify-end gap-1">
      <input type="hidden" name="itemId" value={item.id} />
      {badge}
      {opts.map((o) => (
        <button
          key={o.v}
          type="submit"
          name="status"
          value={o.v}
          className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {o.label}
        </button>
      ))}
    </form>
  );
}

// Balance: 0 means the sheet said "Nill" — flag it rather than showing a bare 0.
function Qty({ n }: { n: number | null }): ReactNode {
  if (n == null) return <span className="text-muted-foreground">—</span>;
  if (n === 0) return <span className="font-medium text-red-600">Nill</span>;
  return <span className="tabular-nums">{n}</span>;
}

interface Col {
  head: string;
  right?: boolean;
  get: (i: RegisterItem) => ReactNode;
}

// Every register's count column is the item's stock balance, so they all share
// one definition.
const BALANCE_COL: Col = {
  head: "Balance",
  right: true,
  get: (i) => <Qty n={i.quantity} />,
};

// Each sheet in the inventory workbook has its own shape, so each category
// declares the columns it renders.
const CATEGORY_VIEWS: { key: string; label: string; cols: Col[] }[] = [
  {
    key: "CHEMICAL",
    label: "Chemicals",
    cols: [
      { head: "Code", get: (i) => <span className="font-mono text-xs">{dash(i.code)}</span> },
      { head: "Name", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Pack", get: (i) => dash(i.pack) },
      { head: "Rack", get: (i) => dash(i.rack) },
      { head: "Category", get: (i) => dash(i.subCategory) },
      { head: "Lot No.", get: (i) => <span className="font-mono text-xs">{dash(i.lotNo)}</span> },
      BALANCE_COL,
    ],
  },
  {
    key: "STANDARD_SOLUTION",
    label: "Standard Solutions",
    cols: [
      { head: "Name", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Packing size", get: (i) => dash(i.pack) },
      { head: "Lot No.", get: (i) => <span className="font-mono text-xs">{dash(i.lotNo)}</span> },
      BALANCE_COL,
    ],
  },
  {
    key: "GLASSWARE",
    label: "Glassware",
    cols: [
      { head: "Name", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Make", get: (i) => dash(i.make) },
      BALANCE_COL,
    ],
  },
  {
    key: "EQUIPMENT",
    label: "Equipment",
    cols: [
      { head: "Code", get: (i) => <span className="font-mono text-xs">{dash(i.code)}</span> },
      { head: "Equipment", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Make", get: (i) => dash(i.make) },
      { head: "Model", get: (i) => dash(i.model) },
      { head: "Parts", get: (i) => dash(i.parts) },
    ],
  },
  {
    key: "STORE_ITEM",
    // The store-items sheet IS the main store's stock balance list.
    label: "Stock balances",
    cols: [
      { head: "Chemical", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Packing size", get: (i) => dash(i.pack) },
      { head: "Category", get: (i) => dash(i.subCategory) },
      BALANCE_COL,
    ],
  },
  {
    key: "MISCELLANEOUS",
    label: "Lab Supplies and PPEs",
    cols: [
      { head: "Item", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Size", get: (i) => dash(i.pack) },
      BALANCE_COL,
    ],
  },
  {
    key: "STATIONERY",
    label: "Stationery",
    cols: [
      { head: "Item", get: (i) => <span className="font-medium">{i.name}</span> },
      { head: "Company", get: (i) => dash(i.make) },
      BALANCE_COL,
    ],
  },
];

// The imported inventory register for a facility's stores, one card per sheet.
function InventoryRegister({
  items,
  isManagement,
}: {
  items: RegisterItem[];
  isManagement: boolean;
}): ReactNode {
  if (items.length === 0) return null;
  return (
    <>
      {CATEGORY_VIEWS.map((view) => {
        const rows = items.filter((i) => i.category === view.key);
        if (rows.length === 0) return null;
        const out = rows.filter((i) => i.quantity === 0).length;
        // Management may view lab registers but not report stock on them.
        const editable = !(isManagement && isLabOnly(view.key));
        const flagged = rows.filter((i) => i.stockStatus !== "OK").length;
        return (
          <Card key={view.key}>
            <CardHeader>
              <CardTitle className="text-base">
                {view.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {rows.length} items
                  {out > 0 && (
                    <span className="ml-2 text-red-600">{out} out of stock</span>
                  )}
                  {flagged > 0 && (
                    <span className="ml-2 text-amber-700">{flagged} reported</span>
                  )}
                  {!editable && <span className="ml-2">· view only</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {view.cols.map((c) => (
                        <TableHead key={c.head} className={c.right ? "text-right" : ""}>
                          {c.head}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Stock status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((i) => (
                      <TableRow key={i.id}>
                        {view.cols.map((c) => (
                          <TableCell
                            key={c.head}
                            className={`${c.right ? "text-right" : ""} text-muted-foreground`}
                          >
                            {c.get(i)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <StockCell item={i} editable={editable} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

// One store bucket's stock + issue-request view. Rendered server-side and
// handed to the Tabs client wrapper, so the server-action forms keep working.
function StorePanel({
  balances,
  issues,
  subStores,
  storeName,
  register,
  itemOptions,
  isManagement,
  canDecide,
  showForm,
}: {
  balances: Balance[];
  issues: Issue[];
  subStores: StoreOpt[];
  storeName: Map<string, string>;
  register: RegisterItem[];
  /** Items available to issue (the main store's stock) with balance + details. */
  itemOptions: {
    name: string;
    pack: string | null;
    subCategory: string | null;
    quantity: number | null;
  }[];
  isManagement: boolean;
  canDecide: boolean;
  showForm: boolean;
}): ReactNode {
  return (
    <div className="space-y-6">
      <InventoryRegister items={register} isManagement={isManagement} />
      {/* Balances accrued from GRN receipts / issue movements. The register
          above already carries the counted balances, so only show this ledger
          once it actually has movements. */}
      {balances.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock balances (GRN &amp; issues)</CardTitle>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && subStores.length > 0 && (
            <form action={requestIssue} className="flex flex-wrap items-end gap-3">
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
                {itemOptions.length > 0 ? (
                  <select
                    name="description"
                    required
                    defaultValue=""
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {itemOptions.map((it) => (
                      <option key={it.name} value={it.name}>
                        {it.name}
                        {it.pack ? ` · ${it.pack}` : ""}
                        {it.subCategory ? ` · ${it.subCategory}` : ""}
                        {" · "}
                        {it.quantity == null
                          ? "qty —"
                          : it.quantity === 0
                            ? "out of stock"
                            : `${it.quantity} available`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="description"
                    required
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  />
                )}
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
          )}

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

export default async function InventoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const [stores, facilities, balancesRaw, issues, registerItems, section] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.facility.findMany(),
    prisma.stockTransaction.groupBy({
      by: ["storeId", "description"],
      _sum: { quantity: true },
    }),
    prisma.issueRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.inventoryItem.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }, { name: "asc" }],
    }),
    prisma.section.findUnique({
      where: { id: user.sectionId },
      select: { type: true },
    }),
  ]);
  // Management staff may view the lab registers but not report stock on them.
  // ADMIN is the app super-admin and bypasses every Tier-1 gate (perms.ts).
  const isManagement = section?.type === "MANAGEMENT" && !isAdmin(user.designation);

  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const facilityCode = new Map(facilities.map((f) => [f.id, f.code]));
  const balances = balancesRaw.filter((b) => (b._sum.quantity ?? 0) !== 0);
  const canDecide = canManageStore(user.designation);

  // Three buckets: each facility's sub-stores, plus the central main store.
  const lahoreStores = stores.filter(
    (s) => facilityCode.get(s.facilityId) === "LAHORE" && s.type === "SUB",
  );
  const rykStores = stores.filter((s) => facilityCode.get(s.facilityId) === "RYK");
  const mainStores = stores.filter((s) => s.type === "MAIN");

  const idsOf = (list: typeof stores) => new Set(list.map((s) => s.id));
  const lahoreIds = idsOf(lahoreStores);
  const rykIds = idsOf(rykStores);
  const mainIds = idsOf(mainStores);

  const inSet = (set: Set<string>) => ({
    balances: balances.filter((b) => set.has(b.storeId)),
    issues: issues.filter((r) => set.has(r.toStoreId)),
    register: registerItems.filter((i) => set.has(i.storeId)),
  });
  const lahore = inSet(lahoreIds);
  const ryk = inSet(rykIds);
  const mainBalances = balances.filter((b) => mainIds.has(b.storeId));
  const mainRegister = registerItems.filter((i) => mainIds.has(i.storeId));
  // Items an issue request can draw — the main store's stock, selectable by name
  // and shown with their packing size, category and available balance.
  const mainItems = [...new Map(mainRegister.map((i) => [i.name, i])).values()]
    .map((i) => ({
      name: i.name,
      pack: i.pack,
      subCategory: i.subCategory,
      quantity: i.quantity,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tabs: TabItem[] = [
    {
      key: "lahore",
      label: "Lahore",
      badge: lahore.register.length + lahore.balances.length || undefined,
      content: (
        <StorePanel
          balances={lahore.balances}
          issues={lahore.issues}
          subStores={lahoreStores}
          storeName={storeName}
          register={lahore.register}
          itemOptions={mainItems}
          isManagement={isManagement}
          canDecide={canDecide}
          showForm
        />
      ),
    },
    {
      key: "ryk",
      label: "Rahimyar Khan",
      badge: ryk.register.length + ryk.balances.length || undefined,
      content: (
        <StorePanel
          balances={ryk.balances}
          issues={ryk.issues}
          subStores={rykStores}
          storeName={storeName}
          register={ryk.register}
          itemOptions={mainItems}
          isManagement={isManagement}
          canDecide={canDecide}
          showForm
        />
      ),
    },
    {
      key: "main",
      label: "Main Store",
      badge: mainRegister.length + mainBalances.length || undefined,
      content: (
        <StorePanel
          balances={mainBalances}
          issues={issues}
          subStores={[]}
          storeName={storeName}
          register={mainRegister}
          itemOptions={mainItems}
          isManagement={isManagement}
          canDecide={canDecide}
          showForm={false}
        />
      ),
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stores &amp; Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock enters the main store via GRN, then moves to sub-stores by issue
          request (BR-10/11).
        </p>
      </div>

      <ImportExcel model="InventoryItem" path="/app/inventory" label="inventory items" />

      <Tabs tabs={tabs} />
    </div>
  );
}
