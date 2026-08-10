import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterClient } from "@/lib/auth/perms";
import { ThirdPartyForm } from "../third-party-form";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function ThirdPartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const tp = await prisma.thirdParty.findUnique({
    where: { id },
    include: { referenceClient: { select: { company: true } } },
  });
  if (!tp) notFound();
  if (!user.canReadCrossSection && tp.facilityId !== user.facilityId) notFound();

  const canEdit = canRegisterClient(user.designation);
  const clients = canEdit
    ? await prisma.client.findMany({
        where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
        select: { id: true, company: true, sector: true },
        orderBy: { company: "asc" },
      })
    : [];
  const clientOpts = clients.map((c) => ({
    id: c.id,
    label: c.company,
    sector: c.sector,
  }));
  const address = [
    tp.addressLine1,
    tp.addressLine2,
    tp.addressLine3,
    [tp.city, tp.province, tp.country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/app/third-parties"
          className="text-sm text-muted-foreground underline"
        >
          ← Third Parties
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{tp.company}</h1>
        <p className="font-mono text-xs text-muted-foreground">{tp.code}</p>
      </div>

      {canEdit ? (
        <ThirdPartyForm
          clients={clientOpts}
          initial={{
            id: tp.id,
            company: tp.company,
            addressLine1: tp.addressLine1,
            addressLine2: tp.addressLine2,
            addressLine3: tp.addressLine3,
            city: tp.city,
            province: tp.province,
            country: tp.country,
            contactPerson: tp.contactPerson,
            contactNumber: tp.contactNumber,
            email: tp.email,
            ntn: tp.ntn,
            stn: tp.stn,
            referenceClientId: tp.referenceClientId,
          }}
        />
      ) : (
        <div className="rounded-md border p-4">
          <Field label="Name" value={tp.company} />
          <Field label="Reference client" value={tp.referenceClient?.company} />
          <Field label="Address" value={address} />
          <Field label="Contact person" value={tp.contactPerson} />
          <Field label="Contact number" value={tp.contactNumber} />
          <Field label="Email" value={tp.email} />
          <Field label="NTN" value={tp.ntn} />
          <Field label="STN" value={tp.stn} />
        </div>
      )}
    </div>
  );
}
