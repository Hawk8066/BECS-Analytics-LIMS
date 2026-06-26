import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canManageEquipment } from "@/lib/auth/perms";
import { EquipmentForm } from "../equipment-form";

export default async function NewEquipmentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManageEquipment(user.designation)) redirect("/app/equipment");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register equipment</h1>
        <p className="text-sm text-muted-foreground">
          An asset tag is assigned automatically.
        </p>
      </div>
      <EquipmentForm />
    </div>
  );
}
