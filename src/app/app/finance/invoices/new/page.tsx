import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canIssueInvoice } from "@/lib/auth/perms";
import { InvoiceForm } from "../invoice-form";

export default async function NewInvoicePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canIssueInvoice(user.designation)) redirect("/app/finance/invoices");

  const clients = await prisma.client.findMany({
    where: user.canReadCrossSection ? {} : { facilityId: user.facilityId },
    orderBy: { company: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          Posts Dr Accounts Receivable / Cr Sales Revenue.
        </p>
      </div>
      <InvoiceForm
        clients={clients.map((c) => ({
          id: c.id,
          label: `${c.company} (${c.clientNo})`,
        }))}
      />
    </div>
  );
}
