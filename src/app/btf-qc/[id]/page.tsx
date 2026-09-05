import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canApproveLot,
  canManageProductionQc,
  canSubmitResult,
  ANALYST_DESIGNATIONS,
} from "@/lib/auth/perms";
import { decideLot, reassignLot } from "@/lib/actions/production-qc";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultForm } from "../result-form";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  BOOKED: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

interface TreeNode {
  id: string;
  lotNo: string;
  refNo: string;
  productName: string;
  unit: string;
  resultValue: number | null;
  verdict: string | null;
  parents: TreeNode[];
}

// Walk the parent lineage upstream (bounded depth) to build the genealogy.
async function buildTree(id: string, depth = 0): Promise<TreeNode | null> {
  if (depth > 6) return null;
  const lot = await prisma.qcLot.findUnique({
    where: { id },
    include: {
      productType: { select: { name: true, unit: true } },
      parents: { select: { parentLotId: true } },
    },
  });
  if (!lot) return null;
  const parents: TreeNode[] = [];
  for (const link of lot.parents) {
    const sub = await buildTree(link.parentLotId, depth + 1);
    if (sub) parents.push(sub);
  }
  return {
    id: lot.id,
    lotNo: lot.lotNo,
    refNo: lot.refNo,
    productName: lot.productType.name,
    unit: lot.productType.unit,
    resultValue: lot.resultValue,
    verdict: lot.verdict,
    parents,
  };
}

function TreeRow({ node, level }: { node: TreeNode; level: number }) {
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 border-l py-1 text-sm"
        style={{ marginLeft: level * 16, paddingLeft: 12 }}
      >
        <span className="text-xs text-muted-foreground">{node.productName}</span>
        <Link href={`/btf-qc/${node.id}`} className="font-medium underline">
          {node.refNo}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{node.lotNo}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {node.resultValue != null ? (
            <>
              {node.resultValue} {node.unit}
              {node.verdict && (
                <Badge variant={node.verdict === "PASS" ? "default" : "destructive"}>
                  {node.verdict}
                </Badge>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">no result</span>
          )}
        </span>
      </div>
      {node.parents.map((p) => (
        <TreeRow key={p.id} node={p} level={level + 1} />
      ))}
    </>
  );
}

async function nameOf(id: string | null): Promise<string> {
  if (!id) return "";
  const u = await prisma.user.findUnique({
    where: { id },
    include: { profile: { select: { fullName: true } } },
  });
  return u?.profile?.fullName ?? u?.email ?? "";
}

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const { id } = await params;
  const lot = await prisma.qcLot.findUnique({
    where: { id },
    include: {
      productType: true,
      children: {
        include: {
          child: {
            select: { id: true, lotNo: true, refNo: true, productType: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!lot) notFound();

  const tree = await buildTree(lot.id);
  const [bookedBy, assignedTo, testedBy, approvedBy, analystUsers] = await Promise.all([
    nameOf(lot.bookedById),
    nameOf(lot.assignedToId),
    nameOf(lot.testedById),
    nameOf(lot.approvedById),
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
  const analysts = analystUsers.map((a) => ({
    id: a.id,
    name: a.profile?.fullName ?? a.email,
  }));
  const canManage = canManageProductionQc(user.designation);
  const canApprove = canApproveLot(user.designation);
  const canSubmit = canSubmitResult(user.designation);
  const mine = lot.assignedToId === user.id;
  const canEnter = lot.status === "BOOKED" && (canManage || (canSubmit && mine));

  const specText =
    lot.productType.specMin == null && lot.productType.specMax == null
      ? "no spec set"
      : lot.productType.specMin != null && lot.productType.specMax != null
        ? `${lot.productType.specMin}–${lot.productType.specMax} ${lot.productType.unit}`
        : lot.productType.specMin != null
          ? `≥ ${lot.productType.specMin} ${lot.productType.unit}`
          : `≤ ${lot.productType.specMax} ${lot.productType.unit}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/btf-qc" className="underline">
              Production QC
            </Link>{" "}
            / {lot.productType.name}
          </p>
          <h1 className="text-2xl font-semibold">{lot.refNo}</h1>
          <p className="font-mono text-xs text-muted-foreground">{lot.lotNo}</p>
        </div>
        <Badge variant={STATUS_VARIANT[lot.status] ?? "outline"}>{lot.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lot details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Product" value={lot.productType.name} />
          <Detail label="Test parameter" value={lot.productType.testParameter} />
          <Detail
            label={lot.productType.basis === "VEHICLE" ? "Vehicle number" : "Batch number"}
            value={lot.refNo}
          />
          <Detail label="Spec" value={specText} />
          <Detail
            label="Date"
            value={lot.producedOn ? formatDate(lot.producedOn) : "—"}
          />
          <Detail
            label="Quantity"
            value={
              lot.quantity != null
                ? `${lot.quantity}${lot.quantityUnit ? ` ${lot.quantityUnit}` : ""}`
                : "—"
            }
          />
          {lot.source && <Detail label="Supplier / source" value={lot.source} />}
          <Detail
            label="Result"
            value={
              lot.resultValue != null
                ? `${lot.resultValue} ${lot.productType.unit}${lot.verdict ? ` (${lot.verdict})` : ""}`
                : "—"
            }
          />
          <Detail label="Booked by" value={bookedBy || "—"} />
          <Detail label="Assigned analyst" value={assignedTo || "— unassigned"} />
          {testedBy && <Detail label="Result by" value={testedBy} />}
          {approvedBy && <Detail label="Reviewed by" value={approvedBy} />}
          {lot.note && <Detail label="Note" value={lot.note} />}
        </CardContent>
      </Card>

      {/* Assign / reassign (Lab Manager, before result) */}
      {lot.status === "BOOKED" && canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={reassignLot} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="lotId" value={lot.id} />
              <select
                name="assignedToId"
                defaultValue={lot.assignedToId ?? ""}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">Unassigned</option>
                {analysts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" type="submit">
                {lot.assignedToId ? "Reassign" : "Assign"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Result entry (assigned analyst or manager) / review (Lab Manager) */}
      {(canEnter || (lot.status === "SUBMITTED" && canApprove)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canEnter ? "Submit result" : "Review result"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canEnter && <ResultForm lotId={lot.id} unit={lot.productType.unit} />}
            {lot.status === "SUBMITTED" && canApprove && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">
                  Result: <span className="font-medium">{lot.resultValue} {lot.productType.unit}</span>
                  {lot.verdict && (
                    <Badge
                      className="ml-2"
                      variant={lot.verdict === "PASS" ? "default" : "destructive"}
                    >
                      {lot.verdict}
                    </Badge>
                  )}
                </span>
                <form action={decideLot} className="flex gap-2">
                  <input type="hidden" name="lotId" value={lot.id} />
                  <Button size="sm" type="submit" name="decision" value="APPROVED">
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" type="submit" name="decision" value="REJECTED">
                    Reject
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Traceability genealogy */}
      {tree && tree.parents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traceability (upstream)</CardTitle>
          </CardHeader>
          <CardContent>
            <TreeRow node={tree} level={0} />
          </CardContent>
        </Card>
      )}

      {/* Where used (downstream) */}
      {lot.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Used in (downstream)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {lot.children.map((c) => (
              <div key={c.child.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">
                  {c.child.productType.name}
                </span>
                <Link href={`/btf-qc/${c.child.id}`} className="font-medium underline">
                  {c.child.refNo}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                  {c.child.lotNo}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
