import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { designationLabel } from "@/lib/labels";
import { prisma } from "@/lib/db";
import {
  canApprovePR,
  canGeneratePO,
  canInspectGoods,
  canManageStore,
  canMarkReceived,
  canRecordQuotation,
  canSelectQuotation,
  canVerifyPR,
} from "@/lib/auth/perms";
import {
  approvePR,
  rejectPR,
  verifyPR,
} from "@/lib/actions/purchase-requests";
import { generatePO } from "@/lib/actions/procurement";
import { canAccessPR } from "@/lib/procurement/access";
import { issueGRN, markReceived } from "@/lib/actions/receiving";
import { packQtyLabel } from "@/lib/procurement/format";
import { inspectionSection } from "@/lib/procurement/inspection";
import { AddQuotationButton } from "./add-quotation-button";
import { Comparative } from "./comparative";
import { InspectButton } from "./inspect-button";
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

export default async function PRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      lines: true,
      quotations: {
        include: { vendor: true, lines: true },
        orderBy: { createdAt: "asc" },
      },
      pos: {
        include: {
          vendor: true,
          lines: { include: { prLine: { select: { category: true } } } },
          receipts: {
            include: { grn: true, inspection: { select: { id: true } } },
            orderBy: { receivedAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      // Set when this requisition was raised by an equipment repair, so the
      // Purchase Officer can see what the work is actually for.
      repair: {
        select: {
          id: true,
          repairNo: true,
          site: true,
          equipment: { select: { assetTag: true, name: true } },
        },
      },
    },
  });
  if (!pr) notFound();
  if (!canAccessPR(user, pr)) notFound();

  const requester = await prisma.user.findUnique({
    where: { id: pr.requestedById },
    include: { profile: { select: { fullName: true } } },
  });
  const canVerify = canVerifyPR(user.designation);
  const canApprove = canApprovePR(user.designation);

  const hasFull = pr.lines.some((l) => l.path === "FULL");
  const showProcurement = pr.status === "APPROVED" || pr.status === "ORDERED";
  const vendors = showProcurement
    ? await prisma.vendor.findMany({ orderBy: { company: "asc" } })
    : [];
  const pkr = (paisa: number | null | undefined) =>
    paisa == null ? "—" : "PKR " + (paisa / 100).toLocaleString("en-PK");

  // Comparative Statement shape: vendors across, PR lines down.
  const comparativeQuotes = pr.quotations.map((q) => ({
    id: q.id,
    vendor: q.vendor.company,
    total: q.amount,
    cells: Object.fromEntries(
      q.lines.map((cl) => [
        cl.prLineId,
        {
          id: cl.id,
          specification: cl.specification,
          rate: cl.rate,
          selected: cl.selected,
        },
      ]),
    ),
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{pr.prNo}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            Purchase Requisition Form · BECS/FF/606/05
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Raised by{" "}
            {requester?.profile?.fullName ?? requester?.email ?? "—"}
            {requester ? ` · ${designationLabel(requester.designation)}` : ""} ·{" "}
            {formatDate(pr.createdAt)}
          </p>
          {pr.repair && (
            <p className="mt-1 text-sm text-muted-foreground">
              Equipment repair{" "}
              <Link
                href={`/app/equipment/repairs/${pr.repair.id}`}
                className="font-mono underline"
              >
                {pr.repair.repairNo}
              </Link>{" "}
              · {pr.repair.equipment.assetTag} {pr.repair.equipment.name} ·{" "}
              {pr.repair.site === "OFF_SITE" ? "off-site" : "on-site"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/app/procurement/${pr.id}/print`}
            className="text-sm text-muted-foreground underline"
          >
            Print
          </Link>
          <Badge>{pr.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {pr.status === "SUBMITTED" && canVerify && (
            <>
              <form action={verifyPR}>
                <input type="hidden" name="prId" value={pr.id} />
                <Button type="submit">Verify</Button>
              </form>
              <form action={rejectPR}>
                <input type="hidden" name="prId" value={pr.id} />
                <Button type="submit" variant="outline">
                  Reject
                </Button>
              </form>
            </>
          )}
          {pr.status === "VERIFIED" && (
            <>
              {canApprove && (
                <form action={approvePR}>
                  <input type="hidden" name="prId" value={pr.id} />
                  <Button type="submit">Approve (COO)</Button>
                </form>
              )}
              {canVerify && (
                <form action={rejectPR}>
                  <input type="hidden" name="prId" value={pr.id} />
                  <Button type="submit" variant="outline">
                    Reject
                  </Button>
                </form>
              )}
            </>
          )}
          {pr.status === "SUBMITTED" && !canVerify && (
            <p className="text-sm text-muted-foreground">Awaiting verification.</p>
          )}
          {pr.status === "VERIFIED" && !canApprove && (
            <p className="text-sm text-muted-foreground">Awaiting COO approval.</p>
          )}
          {pr.status === "APPROVED" && (
            <p className="text-sm text-muted-foreground">
              Approved — record quotations, award the comparative, then generate
              the PO(s).
            </p>
          )}
          {pr.status === "REJECTED" && (
            <p className="text-sm text-red-600">This PR was rejected.</p>
          )}
        </CardContent>
      </Card>

      {showProcurement && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {hasFull ? "Comparative Statement" : "Purchase Order (simplified)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasFull && (
              <>
                {pr.quotations.length > 0 ? (
                  <Comparative
                    prId={pr.id}
                    canAward={
                      canSelectQuotation(user.designation) &&
                      pr.status === "APPROVED"
                    }
                    lines={pr.lines.map((l) => ({
                      id: l.id,
                      description: l.description,
                      specification: l.specification,
                      packSize: l.packSize,
                      quantity: l.quantity,
                      unit: l.unit,
                      selectionNote: l.selectionNote,
                    }))}
                    quotations={comparativeQuotes}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No quotations recorded yet.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 border-t pt-3">
                  {pr.status === "APPROVED" &&
                    canRecordQuotation(user.designation) && (
                      <AddQuotationButton
                        prId={pr.id}
                        vendors={vendors.map((v) => ({
                          id: v.id,
                          company: v.company,
                        }))}
                        lines={pr.lines.map((l) => ({
                          id: l.id,
                          description: l.description,
                          specification: l.specification,
                          packSize: l.packSize,
                          quantity: l.quantity,
                          unit: l.unit,
                        }))}
                      />
                    )}
                  {pr.quotations.length > 0 && (
                    <Link
                      href={`/app/procurement/${pr.id}/comparative`}
                      className="text-sm text-muted-foreground underline"
                    >
                      Print comparative statement
                    </Link>
                  )}
                </div>
              </>
            )}

            {pr.status === "APPROVED" &&
              canGeneratePO(user.designation) &&
              pr.pos.length === 0 &&
              (hasFull ? (
                <form action={generatePO} className="border-t pt-3">
                  <input type="hidden" name="prId" value={pr.id} />
                  <Button
                    type="submit"
                    disabled={!pr.quotations.some((q) => q.selected)}
                  >
                    Generate PO(s) from award
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    One PO is issued per winning vendor.
                  </p>
                </form>
              ) : (
                <form
                  action={generatePO}
                  className="flex flex-wrap items-end gap-3 border-t pt-3"
                >
                  <input type="hidden" name="prId" value={pr.id} />
                  <div className="grid gap-1.5">
                    <label className="text-xs text-muted-foreground">Vendor</label>
                    <select
                      name="vendorId"
                      required
                      defaultValue=""
                      className="h-9 rounded-md border bg-transparent px-2 text-sm"
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.company}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs text-muted-foreground">
                      Amount (PKR)
                    </label>
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-9 rounded-md border bg-transparent px-2 text-sm"
                    />
                  </div>
                  <Button size="sm" type="submit">
                    Generate PO
                  </Button>
                </form>
              ))}

            {pr.pos.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {pr.pos.map((po) => (
                  <Link
                    key={po.id}
                    href={`/app/procurement/po/${po.id}`}
                    className="block rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        PO <span className="font-mono">{po.poNo}</span> ·{" "}
                        <Badge variant="secondary">{po.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Open / print →
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {po.vendor?.company ?? "—"} · {pkr(po.amount)} ·{" "}
                      {po.lines.length} item{po.lines.length === 1 ? "" : "s"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pr.pos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goods Receiving</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {pr.pos.map((po) => {
              // The delivery's items with their inspection-checklist section.
              const inspItems = po.lines.map((l) => ({
                poLineId: l.id,
                name: l.description,
                section: inspectionSection(l.prLine.category),
              }));
              return (
              <div key={po.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    <span className="font-mono">{po.poNo}</span>
                    <span className="ml-2 font-normal text-muted-foreground">
                      {po.vendor?.company ?? "—"}
                    </span>
                  </div>
                  {canMarkReceived(user.designation) &&
                    po.status !== "RECEIVED" && (
                      <form action={markReceived}>
                        <input type="hidden" name="poId" value={po.id} />
                        <Button size="sm" type="submit">
                          Mark delivery received
                        </Button>
                      </form>
                    )}
                </div>
                {po.receipts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No deliveries yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>GRN</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {po.receipts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">
                            {formatDate(r.receivedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === "ACCEPTED"
                                  ? "default"
                                  : r.status === "REJECTED"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.grn?.grnNo ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {r.status === "PENDING_INSPECTION" &&
                                canInspectGoods(user.designation) && (
                                  <InspectButton
                                    receiptId={r.id}
                                    supplier={po.vendor?.company ?? ""}
                                    prNo={pr.prNo}
                                    items={inspItems}
                                  />
                                )}
                              {r.inspection && (
                                <Link
                                  href={`/app/procurement/inspection/${r.id}`}
                                  className="text-xs text-muted-foreground underline"
                                >
                                  Checklist
                                </Link>
                              )}
                              {r.status === "ACCEPTED" &&
                                !r.grn &&
                                canManageStore(user.designation) && (
                                  <form action={issueGRN}>
                                    <input
                                      type="hidden"
                                      name="receiptId"
                                      value={r.id}
                                    />
                                    <Button size="sm" type="submit">
                                      Issue GRN
                                    </Button>
                                  </form>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requested items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Sr#</TableHead>
                  <TableHead>Name of item / services</TableHead>
                  <TableHead>Specification</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pr.lines.map((l, i) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{l.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.specification || "—"}
                    </TableCell>
                    <TableCell>
                      {packQtyLabel(l.quantity, l.packSize, l.unit)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.category}
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.path === "FULL" ? "default" : "secondary"}>
                        {l.path}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.justification || "—"}
                    </TableCell>
                    <TableCell>
                      {l.priority ? (
                        <Badge
                          variant={
                            l.priority === "Urgent"
                              ? "destructive"
                              : l.priority === "High"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {l.priority}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pr.note && (
            <p className="text-sm text-muted-foreground">Note: {pr.note}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
