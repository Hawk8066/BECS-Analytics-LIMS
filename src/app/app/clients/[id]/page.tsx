import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient, canViewFinance } from "@/lib/auth/perms";
import { docBalance } from "@/lib/finance/summary";
import { Money, SectionLabel } from "@/components/finance/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientEditForm } from "./client-edit-form";
import { ClientPortalManager } from "./client-portal-manager";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ISSUED: "secondary",
  PARTIAL: "outline",
  PAID: "default",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      portalUsers: {
        where: { designation: "CLIENT" },
        select: { email: true, status: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: { payments: { select: { amount: true } } },
      },
    },
  });
  if (!client) notFound();
  // Facility scope: only cross-section readers see clients of other facilities.
  if (!user.canReadCrossSection && client.facilityId !== user.facilityId)
    notFound();

  const canEdit = canRegisterClient(user.designation);
  const showFinance = canViewFinance(user.designation);
  const bal = docBalance(client.invoices);
  const login = client.portalUsers[0] ?? null;
  const address = [
    client.addressLine1,
    client.addressLine2,
    client.addressLine3,
    [client.city, client.province, client.country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="text-sm text-muted-foreground underline"
        >
          ← Clients
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{client.company}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {client.clientNo}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <ClientEditForm
              client={{
                id: client.id,
                company: client.company,
                addressLine1: client.addressLine1,
                addressLine2: client.addressLine2,
                addressLine3: client.addressLine3,
                city: client.city,
                province: client.province,
                country: client.country,
                contactPerson: client.contactPerson,
                contactNumber: client.contactNumber,
                sector: client.sector,
                ntn: client.ntn,
                stn: client.stn,
              }}
            />
          ) : (
            <div>
              <Field label="Company" value={client.company} />
              <Field label="Sector" value={client.sector} />
              <Field label="Address" value={address} />
              <Field label="Contact person" value={client.contactPerson} />
              <Field label="Contact number" value={client.contactNumber} />
              <Field label="Email" value={client.email} />
              <Field label="NTN" value={client.ntn} />
              <Field label="STN" value={client.stn} />
            </div>
          )}
        </CardContent>
      </Card>

      {showFinance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <SectionLabel>Invoiced</SectionLabel>
                <div className="text-base font-semibold">
                  <Money value={bal.billed} />
                </div>
              </div>
              <div>
                <SectionLabel>Received</SectionLabel>
                <div className="text-base font-semibold">
                  <Money value={bal.paid} />
                </div>
              </div>
              <div>
                <SectionLabel>Receivable</SectionLabel>
                <div className="text-base font-semibold">
                  <Money value={bal.outstanding} />
                </div>
                {bal.openDocs > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {bal.openDocs} open invoice{bal.openDocs === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
            {client.invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.invoices.map((inv) => {
                      const paid = inv.payments.reduce(
                        (s, p) => s + p.amount,
                        0,
                      );
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/app/finance/invoices/${inv.id}`}
                              className="hover:underline"
                            >
                              {inv.invoiceNo}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={inv.amount} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={paid} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={inv.amount - paid} />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_VARIANT[inv.status] ?? "secondary"}
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No invoices raised for this client yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal login</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <ClientPortalManager
              clientId={client.id}
              email={client.email ?? ""}
              login={login}
            />
          ) : login ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{login.email}</span>
              <Badge variant={login.status === "ACTIVE" ? "default" : "secondary"}>
                {login.status}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portal login.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
