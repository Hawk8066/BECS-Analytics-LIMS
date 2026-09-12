import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canManagePayroll } from "@/lib/auth/perms";
import { staffOnly } from "@/lib/db/scope";
import { setSalaryStructure } from "@/lib/actions/payroll";
import { Button } from "@/components/ui/button";
import { ImportExcel } from "@/components/import-excel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function val(paisa: number | undefined): string {
  return paisa == null ? "" : String(paisa / 100);
}

const FIELDS: { name: string; label: string }[] = [
  { name: "basic", label: "Basic" },
  { name: "houseRent", label: "House rent" },
  { name: "conveyance", label: "Conveyance" },
  { name: "medical", label: "Medical" },
  { name: "otherAllowances", label: "Other" },
  { name: "cashAllowance", label: "Cash allow. (n/t)" },
  { name: "eobi", label: "EOBI" },
];

export default async function SalaryStructuresPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  if (!canManagePayroll(user.designation)) redirect("/app");

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      // Salaries are for staff; portal logins are clients/vendors, not employees.
      ...staffOnly,
      ...(user.canReadCrossSection ? {} : { facilityId: user.facilityId }),
    },
    include: { profile: { select: { fullName: true } } },
    orderBy: { email: "asc" },
  });
  const structures = await prisma.salaryStructure.findMany();
  const byUser = new Map(structures.map((s) => [s.userId, s]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Salary structures</h1>
        <p className="text-sm text-muted-foreground">
          Monthly amounts in PKR. Income tax is computed on the annualised
          taxable pay (FBR salaried slabs, Tax Year 2026-27). Medical is exempt
          up to 10% of basic; the cash allowance (n/t) is paid in cash and is
          not taxable.
        </p>
      </div>

      <ImportExcel
        model="SalaryStructure"
        path="/app/finance/payroll/structures"
        label="salary structures"
      />

      {users.map((u) => {
        const s = byUser.get(u.id);
        return (
          <Card key={u.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {u.profile?.fullName ?? u.email}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({u.designation})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={setSalaryStructure}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="userId" value={u.id} />
                {FIELDS.map((f) => (
                  <div key={f.name} className="grid gap-1">
                    <label className="text-xs text-muted-foreground">
                      {f.label}
                    </label>
                    <input
                      name={f.name}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={val(
                        (s as Record<string, number> | undefined)?.[f.name],
                      )}
                      className="h-9 w-24 rounded-md border bg-transparent px-2 text-sm"
                    />
                  </div>
                ))}
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">PF %</label>
                  <input
                    name="providentFundPct"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={s?.providentFundPct ?? 0}
                    className="h-9 w-16 rounded-md border bg-transparent px-2 text-sm"
                  />
                </div>
                <Button size="sm" type="submit">
                  Save
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
