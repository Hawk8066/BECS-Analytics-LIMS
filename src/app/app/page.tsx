import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {user.email}. Phase 1 — Personnel is in progress.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Personnel</CardTitle>
            <CardDescription>
              HR profiles, functions, authorization
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Manage staff onboarding and the authorization chain.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your scope</CardTitle>
            <CardDescription>Facility &amp; section</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {user.canReadCrossSection
              ? "Cross-section access (senior role)."
              : "Scoped to your own section."}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
