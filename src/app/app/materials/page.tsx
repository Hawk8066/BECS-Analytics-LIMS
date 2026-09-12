import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { ownFacilitySlug } from "@/lib/facilities";

// The register is kept per lab, so the bare path opens the user's own lab.
export default async function MaterialsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  const { type } = await searchParams;
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  redirect(`/app/materials/${await ownFacilitySlug(user)}${query}`);
}
