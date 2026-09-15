import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { ownFacilitySlug } from "@/lib/facilities";

// The register is kept per lab, so the bare path opens the user's own lab.
export default async function EquipmentIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  redirect(`/app/equipment/${await ownFacilitySlug(user)}`);
}
