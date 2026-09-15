import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canManageProductionQc,
  canApproveLot,
  canSubmitResult,
  ANALYST_DESIGNATIONS,
} from "@/lib/auth/perms";
import { decideLot, setProductSpec, reassignLot } from "@/lib/actions/production-qc";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookLotButton } from "./book-lot-button";
import { ResultForm } from "./result-form";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  BOOKED: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

type ProductRow = {
  id: string;
  name: string;
  stage: string;
  basis: "VEHICLE" | "BATCH";
  testParameter: string;
  unit: string;
  specMin: number | null;
  specMax: number | null;
  parentTypeId: string | null;
  parentType: { name: string } | null;
};

type LotRow = {
  id: string;
  lotNo: string;
  refNo: string;
  producedOn: Date | null;
  quantity: number | null;
  quantityUnit: string | null;
  status: string;
  resultValue: number | null;
  verdict: string | null;
  productTypeId: string;
  assignedToId: string | null;
  assignedTo: { profile: { fullName: string | null } | null; email: string } | null;
  _count: { parents: number };
};

type Analyst = { id: string; name: string };

function specText(p: ProductRow): string {
  if (p.specMin == null && p.specMax == null) return "no spec set";
  if (p.specMin != null && p.specMax != null) return `${p.specMin}–${p.specMax} ${p.unit}`;
  if (p.specMin != null) return `≥ ${p.specMin} ${p.unit}`;
  return `≤ ${p.specMax} ${p.unit}`;
}

const analystName = (l: LotRow) =>
  l.assignedTo ? l.assignedTo.profile?.fullName ?? l.assignedTo.email : null;

function ProductPanel({
  product,
  lots,
  parentLots,
  analysts,
  userId,
  canManage,
  canApprove,
  canSubmit,
}: {
  product: ProductRow;
  lots: LotRow[];
  parentLots: LotRow[];
  analysts: Analyst[];
  userId: string;
  canManage: boolean;
  canApprove: boolean;
  canSubmit: boolean;
}): ReactNode {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">
            {product.testParameter}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              per {product.basis === "VEHICLE" ? "vehicle" : "batch"} · spec{" "}
              {specText(product)}
            </span>
          </CardTitle>
          {canManage && (
            <form action={setProductSpec} className="flex items-end gap-2 text-xs">
              <input type="hidden" name="productTypeId" value={product.id} />
              <div className="grid gap-0.5">
                <span className="text-muted-foreground">Min</span>
                <input
                  name="specMin"
                  type="number"
                  step="0.01"
                  defaultValue={product.specMin ?? ""}
                  className="h-8 w-20 rounded-md border bg-transparent px-2"
                />
              </div>
              <div className="grid gap-0.5">
                <span className="text-muted-foreground">Max</span>
                <input
                  name="specMax"
                  type="number"
                  step="0.01"
                  defaultValue={product.specMax ?? ""}
                  className="h-8 w-20 rounded-md border bg-transparent px-2"
                />
              </div>
              <Button size="sm" variant="outline" type="submit">
                Set spec
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab No</TableHead>
                  <TableHead>{product.basis === "VEHICLE" ? "Vehicle" : "Batch"}</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Analyst</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((l) => {
                  const mine = l.assignedToId === userId;
                  const canEnter =
                    l.status === "BOOKED" && (canManage || (canSubmit && mine));
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/btf-qc/${l.id}`} className="underline">
                          {l.lotNo}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{l.refNo}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {l.producedOn ? formatDate(l.producedOn) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {analystName(l) ?? (
                          <span className="italic text-amber-700">unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.resultValue != null ? (
                          <span className="flex items-center gap-1.5">
                            {l.resultValue}
                            {l.verdict && (
                              <Badge variant={l.verdict === "PASS" ? "default" : "destructive"}>
                                {l.verdict}
                              </Badge>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canEnter && <ResultForm lotId={l.id} unit={product.unit} />}
                        {l.status === "BOOKED" && canManage && !l.assignedToId && (
                          <form action={reassignLot} className="flex justify-end gap-1.5">
                            <input type="hidden" name="lotId" value={l.id} />
                            <select
                              name="assignedToId"
                              defaultValue=""
                              className="h-8 rounded-md border bg-transparent px-2 text-xs"
                            >
                              <option value="" disabled>
                                Assign…
                              </option>
                              {analysts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" variant="outline" type="submit">
                              Assign
                            </Button>
                          </form>
                        )}
                        {l.status === "SUBMITTED" && canApprove && (
                          <form action={decideLot} className="flex justify-end gap-2">
                            <input type="hidden" name="lotId" value={l.id} />
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
                  );
                })}
                {lots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No lots booked yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <BookLotButton
            productTypeId={product.id}
            basis={product.basis}
            isRaw={product.stage === "RAW"}
            parentTypeName={product.parentType?.name ?? null}
            parentLots={parentLots.map((p) => ({
              id: p.id,
              lotNo: p.lotNo,
              refNo: p.refNo,
              verdict: p.verdict,
            }))}
            analysts={analysts}
          />
        </div>
      )}
    </div>
  );
}

export default async function ProductionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const [products, lots, analystUsers] = await Promise.all([
    prisma.productType.findMany({
      orderBy: { sortOrder: "asc" },
      include: { parentType: { select: { name: true } } },
    }),
    prisma.qcLot.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { parents: true } },
        assignedTo: {
          select: { email: true, profile: { select: { fullName: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        designation: { in: [...ANALYST_DESIGNATIONS] },
        status: "ACTIVE",
        facility: { code: "RYK" },
      },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
      orderBy: { email: "asc" },
    }),
  ]);

  const analysts: Analyst[] = analystUsers.map((a) => ({
    id: a.id,
    name: a.profile?.fullName ?? a.email,
  }));
  const canManage = canManageProductionQc(user.designation);
  const canApprove = canApproveLot(user.designation);
  const canSubmit = canSubmitResult(user.designation);

  const tabs: TabItem[] = products.map((p) => {
    const productLots = lots.filter((l) => l.productTypeId === p.id);
    const parentLots = p.parentTypeId
      ? lots.filter((l) => l.productTypeId === p.parentTypeId)
      : [];
    return {
      key: p.id,
      label: p.name,
      badge: productLots.length || undefined,
      content: (
        <ProductPanel
          product={p as ProductRow}
          lots={productLots as LotRow[]}
          parentLots={parentLots as LotRow[]}
          analysts={analysts}
          userId={user.id}
          canManage={canManage}
          canApprove={canApprove}
          canSubmit={canSubmit}
        />
      ),
    };
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Production QC &amp; Traceability</h1>
          <p className="text-sm text-muted-foreground">
            Lab Manager books &amp; assigns; the analyst submits results; the Lab
            Manager reviews. Raw Zinc (vehicle) → AOM (batch) → Zabardast Urea.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/btf-qc/dashboard"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Dashboard
          </Link>
          {canManageProductionQc(user.designation) && (
            <Link
              href="/btf-qc/performance"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Performance
            </Link>
          )}
          <Link
            href="/btf-qc/reports"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Monthly reports
          </Link>
        </div>
      </div>

      {tabs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No product types configured.</p>
      ) : (
        <Tabs tabs={tabs} />
      )}
    </div>
  );
}
