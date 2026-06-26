import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canApproveProfile } from "@/lib/auth/perms";
import { approveProfile } from "@/lib/actions/personnel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

export default async function PersonnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const person = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, facility: true, section: true },
  });
  if (!person) notFound();

  const p = person.profile;
  const canApprove =
    canApproveProfile(user.designation) &&
    person.status === "PENDING_APPROVAL";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p?.fullName ?? person.email}</h1>
          <p className="text-sm text-muted-foreground">
            {person.designation} &middot; {person.facility.code} /{" "}
            {person.section.name}
          </p>
        </div>
        <Badge>{person.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Email" value={person.email} />
          <Field label="Title" value={p?.title} />
          <Field label="Father's name" value={p?.fatherName} />
          <Field label="CNIC" value={p?.cnic} />
          <Field label="Contact" value={p?.contactNumber} />
          <Field label="Blood group" value={p?.bloodGroup} />
          <Field label="Emergency contact" value={p?.emergencyContact} />
          <Field label="Education" value={p?.education} />
          <Field label="Experience" value={p?.experience} />
          <Field label="Skills" value={p?.skills} />
        </CardContent>
      </Card>

      {canApprove && (
        <form action={approveProfile}>
          <input type="hidden" name="userId" value={person.id} />
          <Button type="submit">Approve &amp; activate (COO)</Button>
        </form>
      )}
    </div>
  );
}
