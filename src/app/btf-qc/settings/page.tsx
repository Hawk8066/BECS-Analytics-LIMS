import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canAdminister } from "@/lib/auth/perms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProductTypeButton } from "../new-product-type-button";
import { NewParameterButton } from "../new-parameter-button";

/**
 * Production QC setup — defining what is tested and what it is billed at.
 *
 * Kept apart from the day-to-day screens because this is configuration, not QC
 * work: it is gated on `canAdminister`, which the Lab Manager who runs the rest
 * of this section does not hold.
 */
export default async function QcSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");
  // The sidebar hides this link for everyone else; this is the gate that holds.
  if (!canAdminister(user.designation)) redirect("/btf-qc");

  const [products, parameters] = await Promise.all([
    prisma.productType.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        stage: true,
        testParameter: true,
        unit: true,
        parameter: { select: { name: true, price: true } },
      },
    }),
    // Only approved parameters can be offered as a billing rate — the filter
    // the monthly-invoice screen applies too.
    prisma.parameter.findMany({
      where: { approvedAt: { not: null } },
      select: { id: true, name: true, matrix: true, price: true },
      orderBy: [{ name: "asc" }, { matrix: "asc" }],
    }),
  ]);

  const usedMatrices = [
    ...new Set(parameters.map((p) => p.matrix).filter((m): m is string => !!m)),
  ].sort();
  const parentOptions = products.map((p) => ({ id: p.id, name: p.name }));
  const pkr = (paisa: number) => "PKR " + (paisa / 100).toLocaleString("en-PK");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Product types and the catalogue parameters their testing is billed at.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Product types</CardTitle>
          <div className="flex gap-2">
            <NewParameterButton matrices={usedMatrices} />
            <NewProductTypeButton
              parents={parentOptions}
              parameters={parameters}
            />
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No product types yet. Add one to start booking QC lots against it.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Test</th>
                    <th className="px-3 py-2 font-medium">Billed as</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.stage}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.testParameter}
                        {p.unit ? ` (${p.unit})` : ""}
                      </td>
                      <td className="px-3 py-2">
                        {p.parameter?.name ?? (
                          <span className="text-muted-foreground">not linked</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.parameter?.price != null ? (
                          pkr(p.parameter.price)
                        ) : (
                          <span className="text-muted-foreground">unpriced</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Rates live in Samples › Parameters. A product with no linked
            parameter, or one with no price, is not billed — its approved lots
            stay open until it is priced, rather than being lost.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
