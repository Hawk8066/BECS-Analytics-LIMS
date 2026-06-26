import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canApproveProfile,
  canEvaluateCompetence,
  canGrantAuthorization,
} from "@/lib/auth/perms";
import { approveProfile } from "@/lib/actions/personnel";
import {
  grantAuthorization,
  revokeAuthorization,
} from "@/lib/actions/authorization";
import { CompetenceForm } from "./competence-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

function isAuthActive(a: { status: string; expiresAt: Date | null }): boolean {
  return a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > new Date());
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

  const [person, competences, authorizations, approvedFunctions] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: { profile: true, facility: true, section: true },
      }),
      prisma.competenceEvaluation.findMany({
        where: { subjectId: id },
        include: { function: true },
        orderBy: { evaluatedAt: "desc" },
      }),
      prisma.authorization.findMany({
        where: { subjectId: id },
        include: { function: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.function.findMany({
        where: { approvedAt: { not: null } },
        orderBy: { code: "asc" },
      }),
    ]);
  if (!person) notFound();

  const p = person.profile;
  const canApprove =
    canApproveProfile(user.designation) && person.status === "PENDING_APPROVAL";
  const canEvaluate = canEvaluateCompetence(user.designation);
  const canGrant = canGrantAuthorization(user.designation);

  // Functions this person has competence for (candidates for authorization).
  const competentFunctions = Array.from(
    new Map(competences.map((c) => [c.function.id, c.function])).values(),
  );
  const jobDescription = authorizations.filter(isAuthActive);

  return (
    <div className="max-w-3xl space-y-6">
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
          <Field label="Education" value={p?.education} />
          <Field label="Skills" value={p?.skills} />
        </CardContent>
      </Card>

      {canApprove && (
        <form action={approveProfile}>
          <input type="hidden" name="userId" value={person.id} />
          <Button type="submit">Approve &amp; activate (COO)</Button>
        </form>
      )}

      {/* Job Description — derived from active authorizations (SSOT §6) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          {jobDescription.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active authorizations.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {jobDescription.map((a) => (
                <li key={a.id}>
                  <Badge variant="secondary">{a.function.name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Competence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Valid until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competences.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">
                    {c.function.code}
                  </TableCell>
                  <TableCell>{c.result}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.validUntil
                      ? c.validUntil.toISOString().slice(0, 10)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {competences.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No competence recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {canEvaluate && (
            <CompetenceForm
              subjectId={person.id}
              functions={approvedFunctions.map((f) => ({
                id: f.id,
                code: f.code,
                name: f.name,
              }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Authorizations (Tier-2 gating) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authorizations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authorizations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    {a.function.code}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isAuthActive(a) ? "default" : "outline"}>
                      {isAuthActive(a) ? "ACTIVE" : a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.expiresAt ? a.expiresAt.toISOString().slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canGrant && a.status === "ACTIVE" && (
                      <form action={revokeAuthorization}>
                        <input type="hidden" name="authorizationId" value={a.id} />
                        <input type="hidden" name="subjectId" value={person.id} />
                        <Button size="sm" variant="outline" type="submit">
                          Revoke
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {authorizations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No authorizations.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {canGrant && competentFunctions.length > 0 && (
            <form
              action={grantAuthorization}
              className="flex flex-wrap items-end gap-3 border-t pt-4"
            >
              <input type="hidden" name="subjectId" value={person.id} />
              <div className="grid gap-1.5">
                <label htmlFor="functionId" className="text-xs text-muted-foreground">
                  Grant authorization (competent functions)
                </label>
                <select
                  id="functionId"
                  name="functionId"
                  required
                  defaultValue=""
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {competentFunctions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="expiresAt" className="text-xs text-muted-foreground">
                  Expires (optional)
                </label>
                <input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                />
              </div>
              <Button size="sm" type="submit">
                Grant (COO)
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
