import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterVendor } from "@/lib/auth/perms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VendorEditForm } from "./vendor-edit-form";
import { VendorPortalManager } from "./vendor-portal-manager";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      portalUsers: {
        where: { designation: "VENDOR" },
        select: { email: true, status: true },
      },
    },
  });
  if (!vendor) notFound();

  const canEdit = canRegisterVendor(user.designation);
  const login = vendor.portalUsers[0] ?? null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/app/vendors"
            className="text-sm text-muted-foreground underline"
          >
            ← Vendors
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{vendor.company}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {vendor.vendorNo}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <VendorEditForm
              vendor={{
                id: vendor.id,
                company: vendor.company,
                address: vendor.address,
                contactNumber: vendor.contactNumber,
                ntn: vendor.ntn,
                stn: vendor.stn,
                employees: vendor.employees,
                accountNumber: vendor.accountNumber,
                fields: vendor.fields,
              }}
            />
          ) : (
            <div>
              <Field label="Company" value={vendor.company} />
              <Field label="Address" value={vendor.address} />
              <Field label="Contact number" value={vendor.contactNumber} />
              <Field label="Account number" value={vendor.accountNumber} />
              <Field label="NTN" value={vendor.ntn} />
              <Field label="STN" value={vendor.stn} />
              <Field
                label="Employees"
                value={vendor.employees != null ? String(vendor.employees) : null}
              />
              <Field label="Fields supplied" value={vendor.fields.join(", ")} />
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
            <VendorPortalManager
              vendorId={vendor.id}
              email={vendor.email ?? ""}
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
