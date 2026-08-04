import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { canRegisterSample, canCoordinateTesting } from "@/lib/auth/perms";
import { canSeeClientIdentity } from "@/lib/samples/blinding";
import { sampleListWhere } from "@/lib/samples/access";
import { loadSampleFormData } from "./form-data";
import { RegisterSampleButton } from "./register-sample-button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  REGISTERED: "secondary",
  ASSIGNED: "outline",
  RESULTS_ENTERED: "outline",
  VERIFIED: "outline",
  APPROVED: "default",
  REPORTED: "default",
};

export default async function SamplesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/app/onboarding");

  const seeClient = canSeeClientIdentity(user.designation);
  const canRegister = canRegisterSample(user.designation);

  // Blinding (ADR-0002): client data is only queried for roles allowed to see it.
  const samples = await prisma.sample.findMany({
    where: sampleListWhere(user),
    include: { parameters: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Only load the register form's data when the button will actually be shown.
  const formData = canRegister ? await loadSampleFormData(user) : null;

  const clientMap = new Map<string, string>();
  if (seeClient && samples.length > 0) {
    const clients = await prisma.client.findMany({
      where: { id: { in: [...new Set(samples.map((s) => s.clientId))] } },
      select: { id: true, company: true },
    });
    for (const c of clients) clientMap.set(c.id, c.company);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Samples</h1>
          <p className="text-sm text-muted-foreground">
            {samples.length} in scope
            {seeClient ? "" : " · client identity blinded"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCoordinateTesting(user.designation) && (
            <Link
              href="/app/samples/performance"
              className={buttonVariants({ variant: "outline" })}
            >
              Performance
            </Link>
          )}
          {canRegister && formData && <RegisterSampleButton {...formData} />}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lab ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>{seeClient ? "Client" : "Client (blinded)"}</TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/app/samples/${s.id}`} className="hover:underline">
                    {s.labId}
                  </Link>
                </TableCell>
                <TableCell>{s.sampleType}</TableCell>
                <TableCell className="text-muted-foreground">
                  {seeClient ? (clientMap.get(s.clientId) ?? "—") : "•••••"}
                </TableCell>
                <TableCell>{s.parameters.length}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                    {s.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {samples.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No samples in scope.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
