import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
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
import {
  addQuotation,
  generatePO,
  selectQuotation,
} from "@/lib/actions/procurement";
import { canAccessPR } from "@/lib/procurement/access";
import {
  inspectReceipt,
  issueGRN,
  markReceived,
} from "@/lib/actions/receiving";
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
      quotations: { include: { vendor: true }, orderBy: { amount: "asc" } },
      po: {
        include: {
          vendor: true,
          receipts: { include: { grn: true }, orderBy: { receivedAt: "asc" } },
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

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{pr.prNo}</h1>
          <p className="text-sm text-muted-foreground">
            Raised by {requester?.profile?.fullName ?? requester?.email ?? "—"}
          </p>
        </div>
        <Badge>{pr.status}</Badge>
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
              Approved — quotations / PO / GRN in the next phase.
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
              {hasFull ? "Quotations & Comparative" : "Purchase Order (simplified)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasFull && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Select</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pr.quotations.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>{q.vendor.company}</TableCell>
                        <TableCell>{pkr(q.amount)}</TableCell>
                        <TableCell className="text-right">
                          {q.selected ? (
                            <Badge>Selected</Badge>
                          ) : (
                            canSelectQuotation(user.designation) &&
                            pr.status === "APPROVED" && (
                              <form action={selectQuotation}>
                                <input type="hidden" name="prId" value={pr.id} />
                                <input type="hidden" name="quotationId" value={q.id} />
                                <Button size="sm" variant="outline" type="submit">
                                  Select
                                </Button>
                              </form>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {pr.quotations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          No quotations yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {pr.status === "APPROVED" && canRecordQuotation(user.designation) && (
                  <form
                    action={addQuotation}
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
                        required
                        className="h-9 rounded-md border bg-transparent px-2 text-sm"
                      />
                    </div>
                    <Button size="sm" type="submit">
                      Add quotation
                    </Button>
                  </form>
                )}
              </>
            )}

            {pr.status === "APPROVED" &&
              canGeneratePO(user.designation) &&
              !pr.po &&
              (hasFull ? (
                <form action={generatePO} className="border-t pt-3">
                  <input type="hidden" name="prId" value={pr.id} />
                  <Button
                    type="submit"
                    disabled={!pr.quotations.some((q) => q.selected)}
                  >
                    Generate PO from selected quote
                  </Button>
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

            {pr.po && (
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">
                  PO <span className="font-mono">{pr.po.poNo}</span> ·{" "}
                  <Badge variant="secondary">{pr.po.status}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {pr.po.vendor?.company ?? "—"} · {pkr(pr.po.amount)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pr.po && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goods Receiving</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canMarkReceived(user.designation) && (
              <form action={markReceived}>
                <input type="hidden" name="poId" value={pr.po.id} />
                <Button size="sm" type="submit">
                  Mark delivery received
                </Button>
              </form>
            )}
            {pr.po.receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliveries yet.</p>
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
                  {pr.po.receipts.map((r) => (
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
                        {r.status === "PENDING_INSPECTION" &&
                          canInspectGoods(user.designation) && (
                            <form
                              action={inspectReceipt}
                              className="flex justify-end gap-2"
                            >
                              <input type="hidden" name="receiptId" value={r.id} />
                              <Button
                                size="sm"
                                type="submit"
                                name="decision"
                                value="ACCEPTED"
                              >
                                Accept
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
                        {r.status === "ACCEPTED" &&
                          !r.grn &&
                          canManageStore(user.designation) && (
                            <form action={issueGRN}>
                              <input type="hidden" name="receiptId" value={r.id} />
                              <Button size="sm" type="submit">
                                Issue GRN
                              </Button>
                            </form>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pr.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.category}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.path === "FULL" ? "default" : "secondary"}>
                      {l.path}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.quantity}
                    {l.unit ? ` ${l.unit}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pr.note && (
            <p className="text-sm text-muted-foreground">Note: {pr.note}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
