import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient } from "@/lib/auth/perms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientEditForm } from "./client-edit-form";
import { ClientPortalManager } from "./client-portal-manager";

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
    },
  });
  if (!client) notFound();
  // Facility scope: only cross-section readers see clients of other facilities.
  if (!user.canReadCrossSection && client.facilityId !== user.facilityId)
    notFound();

  const canEdit = canRegisterClient(user.designation);
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
