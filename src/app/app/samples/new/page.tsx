import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canRegisterSample } from "@/lib/auth/perms";
import { loadSampleFormData } from "../form-data";
import { SampleForm } from "../sample-form";

export default async function NewSamplePage({
  searchParams,
}: {
  /** ?quotation=<id> — arriving from "Register sample" on an accepted quote. */
  searchParams: Promise<{ quotation?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canRegisterSample(user.designation)) redirect("/app/samples");

  const { quotation: fromQuotation } = await searchParams;
  const data = await loadSampleFormData(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register sample</h1>
        <p className="text-sm text-muted-foreground">
          A coded Lab ID is assigned; the sample is blinded for testing.
        </p>
      </div>
      <SampleForm {...data} defaultQuotationId={fromQuotation} />
    </div>
  );
}
