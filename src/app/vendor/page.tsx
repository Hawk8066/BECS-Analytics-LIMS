import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function pkr(paisa: number | null): string {
  if (paisa == null) return "—";
  return "PKR " + (paisa / 100).toLocaleString("en-PK");
}

const PO_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ISSUED: "secondary",
  RECEIVED: "default",
  CANCELLED: "destructive",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function VendorHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.designation !== "VENDOR" || !user.vendorId) redirect("/app");

  const [vendor, orders, quotations] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: user.vendorId } }),
    prisma.purchaseOrder.findMany({
      where: { vendorId: user.vendorId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.quotation.findMany({
      where: { vendorId: user.vendorId },
      include: { pr: { select: { prNo: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!vendor) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {vendor.company}</h1>
        <p className="text-sm text-muted-foreground">
          Your account details, purchase orders and quotations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My details</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Vendor No" value={vendor.vendorNo} />
          <Field label="Company" value={vendor.company} />
          <Field label="Email" value={vendor.email} />
          <Field label="Contact number" value={vendor.contactNumber} />
          <Field label="Address" value={vendor.address} />
          <Field label="NTN" value={vendor.ntn} />
          <Field label="STN" value={vendor.stn} />
          <Field label="Fields supplied" value={vendor.fields.join(", ")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/vendor/po/${o.id}`} className="hover:underline">
                        {o.poNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(o.createdAt)}
                    </TableCell>
                    <TableCell>{pkr(o.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={PO_VARIANT[o.status] ?? "secondary"}>
                        {o.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No purchase orders yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My quotations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Selected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/vendor/quotations/${q.id}`}
                        className="hover:underline"
                      >
                        {q.pr.prNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(q.createdAt)}
                    </TableCell>
                    <TableCell>{pkr(q.amount)}</TableCell>
                    <TableCell>
                      {q.selected ? <Badge>Selected</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {quotations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No quotations yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
