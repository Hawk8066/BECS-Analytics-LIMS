import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canManageQuotations } from "@/lib/auth/perms";
import { loadQuotationFormData } from "../form-data";
import { QuotationForm } from "../quotation-form";

export default async function NewQuotationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManageQuotations(user.designation)) redirect("/app/quotations");

  const data = await loadQuotationFormData(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New quotation</h1>
        <p className="text-sm text-muted-foreground">
          Pick a client, then select parameters/packages; prices come from the
          parameter price list.
        </p>
      </div>
      <QuotationForm {...data} />
    </div>
  );
}
