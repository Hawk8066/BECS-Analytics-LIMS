import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canRegisterVendor } from "@/lib/auth/perms";
import { VendorForm } from "../vendor-form";

export default async function NewVendorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterVendor(user.designation)) redirect("/app/vendors");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register vendor</h1>
        <p className="text-sm text-muted-foreground">
          A vendor number is assigned automatically.
        </p>
      </div>
      <VendorForm />
    </div>
  );
}
