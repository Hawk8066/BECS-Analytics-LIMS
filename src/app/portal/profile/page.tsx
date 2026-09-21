import { clientAddress, requireClient } from "@/lib/portal/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function PortalProfilePage() {
  const { client } = await requireClient();
  const address = clientAddress(client);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My details</h1>
        <p className="text-sm text-muted-foreground">
          How BECS has you recorded. Contact us to change anything here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{client.company}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Client No" value={client.clientNo} />
          <Field label="Company" value={client.company} />
          <Field label="Sector" value={client.sector} />
          <Field label="Contact person" value={client.contactPerson} />
          <Field label="Contact number" value={client.contactNumber} />
          <Field label="Email" value={client.email} />
          <Field label="NTN" value={client.ntn} />
          <Field label="STN" value={client.stn} />
          <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
            <span className="text-muted-foreground">Address</span>
            <span className="whitespace-pre-line">{address || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
