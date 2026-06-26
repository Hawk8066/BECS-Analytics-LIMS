import { redirect } from "next/navigation";
import { Designation } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManagePersonnel } from "@/lib/auth/perms";
import { PersonnelShellForm } from "../personnel-shell-form";

export default async function NewPersonnelPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManagePersonnel(user.designation)) redirect("/app/personnel");

  const [facilities, sections] = await Promise.all([
    prisma.facility.findMany({ orderBy: { code: "asc" } }),
    prisma.section.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New personnel</h1>
        <p className="text-sm text-muted-foreground">
          Create the profile shell (name, contact, designation, facility/section).
        </p>
      </div>
      <PersonnelShellForm
        facilities={facilities.map((f) => ({ id: f.id, name: f.name }))}
        sections={sections.map((s) => ({
          id: s.id,
          name: s.name,
          facilityId: s.facilityId,
        }))}
        designations={Object.values(Designation)}
      />
    </div>
  );
}
