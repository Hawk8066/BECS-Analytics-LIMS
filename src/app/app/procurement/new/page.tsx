import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { designationLabel } from "@/lib/labels";
import { PRForm } from "../pr-form";

export default async function NewPRPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const [profile, items] = await Promise.all([
    prisma.personnelProfile.findUnique({
      where: { userId: user.id },
      select: { fullName: true },
    }),
    prisma.inventoryItem.findMany({
      where: { facilityId: user.facilityId },
      select: { name: true, category: true, pack: true, make: true, model: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const requesterName = profile?.fullName ?? user.email;
  const itemOpts = items.map((it) => ({
    name: it.name,
    category: it.category,
    pack: it.pack ?? "",
    spec: [it.make, it.model].filter(Boolean).join(", "),
  }));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Requisition Form</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            BECS/FF/606/05 · Rev 02 · Issue 01
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Any employee may raise a PR; it routes to verification then COO
            approval.
          </p>
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground">
            Date:{" "}
            <span className="font-medium text-foreground">
              {formatDate(new Date())}
            </span>
          </div>
          <div className="text-muted-foreground">
            Requested by:{" "}
            <span className="font-medium text-foreground">{requesterName}</span>
          </div>
          <div className="text-muted-foreground">
            Designation:{" "}
            <span className="font-medium text-foreground">
              {designationLabel(user.designation)}
            </span>
          </div>
        </div>
      </div>

      <PRForm items={itemOpts} />
    </div>
  );
}
