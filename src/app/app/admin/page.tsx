import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { listModels, countAll } from "@/lib/admin/registry";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canAdminister(user.designation)) redirect("/app");

  const models = listModels();
  const counts = await countAll();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin · Data</h1>
        <p className="text-sm text-muted-foreground">
          Super-admin access — view, edit and delete any record across all{" "}
          {models.length} models. Every change is written to the immutable{" "}
          <Link href="/app/logs" className="underline">
            Activity Log
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {models.map((m) => (
          <Link key={m.name} href={`/app/admin/${m.name}`}>
            <Card className="transition-colors hover:border-foreground/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{m.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold tabular-nums">
                  {counts[m.name] >= 0 ? counts[m.name] : "—"}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">rows</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
