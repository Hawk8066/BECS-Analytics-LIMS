import { redirect } from "next/navigation";
import type { Designation } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import {
  ASSIGNABLE_DESIGNATIONS,
  CAPABILITIES,
  CAPABILITY_GROUPS,
} from "@/lib/auth/capabilities";
import { readMatrix } from "@/lib/auth/capability-store";
import {
  saveCapabilityMatrix,
  resetCapabilityMatrix,
} from "@/lib/actions/capabilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Short column headings — the full designation names are far too wide for a
// 12-column matrix.
const SHORT: Record<string, string> = {
  COO: "COO",
  OPERATIONS_MANAGER: "OM",
  LAB_MANAGER_RYK: "LM-RYK",
  ANALYST: "Analyst",
  ANALYST_RYK: "An-RYK",
  LAB_ASSISTANT: "Lab Asst",
  LAB_ATTENDANT: "Lab Att",
  LIAISON_OFFICER: "LO",
  ACCOUNTANT: "Acct",
  PURCHASE_OFFICER: "Purch",
  STORE_INCHARGE: "Store",
  IT_OFFICER: "IT",
  SALES_MARKETING_OFFICER: "Sales",
};

export default async function AdminRolesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canAdminister(user.designation)) redirect("/app");

  const matrix = await readMatrix();
  const customisedCount = Object.values(matrix).filter(
    (m) => m.customised,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Roles &amp; Capabilities</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Assign each task to the designations allowed to perform it. Anything
            left at its built-in default is shown unmarked; tick or untick to
            override. <strong>ADMIN always retains every capability</strong> and
            access to this screen, so you cannot lock yourself out. Changes take
            effect immediately and are written to the Activity Log.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {customisedCount === 0
              ? "All capabilities are at their defaults."
              : `${customisedCount} capabilit${customisedCount === 1 ? "y" : "ies"} customised.`}
          </p>
        </div>
        {customisedCount > 0 && (
          <form action={resetCapabilityMatrix}>
            <Button type="submit" variant="outline" size="sm">
              Reset all to defaults
            </Button>
          </form>
        )}
      </div>

      <form action={saveCapabilityMatrix} className="space-y-6">
        {CAPABILITY_GROUPS.map((group) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-base">{group}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="w-[38%] py-2 text-left font-medium">
                        Task
                      </th>
                      {ASSIGNABLE_DESIGNATIONS.map((d) => (
                        <th
                          key={d}
                          className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                        >
                          {SHORT[d] ?? d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CAPABILITIES.filter((c) => c.group === group).map((c) => {
                      const row = matrix[c.key];
                      const on = new Set<Designation>(row?.designations ?? []);
                      return (
                        <tr key={c.key} className="border-b last:border-0">
                          <td className="py-2 pr-3 align-top">
                            <div className="font-medium">{c.label}</div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {c.key}
                              </span>
                              {row?.customised && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                  customised
                                </Badge>
                              )}
                            </div>
                          </td>
                          {ASSIGNABLE_DESIGNATIONS.map((d) => (
                            <td key={d} className="px-1 py-2 text-center">
                              <input
                                type="checkbox"
                                name={`cap:${c.key}`}
                                value={d}
                                defaultChecked={on.has(d)}
                                aria-label={`${c.label} — ${SHORT[d] ?? d}`}
                                className="size-4 align-middle"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="sticky bottom-4 flex justify-end">
          <Button type="submit">Save role assignments</Button>
        </div>
      </form>
    </div>
  );
}
