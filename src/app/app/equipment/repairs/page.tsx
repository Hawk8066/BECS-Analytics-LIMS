import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { ownFacilitySlug } from "@/lib/facilities";

// Repairs are kept per lab, so the bare path opens the user's own lab.
export default async function RepairsIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  redirect(`/app/equipment/${await ownFacilitySlug(user)}/repairs`);
}
