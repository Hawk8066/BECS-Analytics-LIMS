import { redirect } from "next/navigation";
import { ItemCategory } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/current-user";
import { PRForm } from "../pr-form";

export default async function NewPRPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Purchase Request</h1>
        <p className="text-sm text-muted-foreground">
          Any employee may raise a PR; it routes to verification then COO approval.
        </p>
      </div>
      <PRForm categories={Object.values(ItemCategory)} />
    </div>
  );
}
