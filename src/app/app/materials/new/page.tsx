import { redirect } from "next/navigation";
import { MaterialType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/current-user";
import { canManageMaterials } from "@/lib/auth/perms";
import { MaterialForm } from "../material-form";

export default async function NewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManageMaterials(user.designation)) redirect("/app/materials");

  const sp = await searchParams;
  const valid = Object.values(MaterialType) as string[];
  const type = valid.includes(sp.type ?? "") ? sp.type! : "CHEMICAL";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register material</h1>
        <p className="text-sm text-muted-foreground">
          Add certificates (CoA / MSDS / reference / calibration) from the detail
          page after registering.
        </p>
      </div>
      <MaterialForm type={type} />
    </div>
  );
}
