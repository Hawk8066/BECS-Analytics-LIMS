import { requireVendor } from "@/lib/portal/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "../shared";

export default async function VendorProfilePage() {
  const { vendor } = await requireVendor();

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
          <CardTitle className="text-base">{vendor.company}</CardTitle>
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
    </div>
  );
}
