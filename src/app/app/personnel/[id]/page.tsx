import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  canApproveProfile,
  canEvaluateCompetence,
  canGrantAuthorization,
  canManagePersonnel,
} from "@/lib/auth/perms";
import { approveProfile } from "@/lib/actions/personnel";
import { ProfileSection } from "./profile-section";
import { EducationSection } from "./education-section";
import { ExperienceSection } from "./experience-section";
import { TrainingSection } from "./training-section";
import { PublicationSection } from "./publication-section";
import { uploadProfilePicture } from "@/lib/actions/personnel";
import { FileUploadButton } from "@/components/ui/file-upload-button";
import { DateInput } from "@/components/ui/date-input";
import { designationLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import {
  grantAuthorization,
  revokeAuthorization,
} from "@/lib/actions/authorization";
import { CompetenceForm } from "./competence-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        include: {
          profile: {
            include: {
              educationEntries: { orderBy: { startYear: "asc" } },
              experienceEntries: { orderBy: { startDate: "asc" } },
              trainingEntries: { orderBy: { year: "asc" } },
              publicationEntries: { orderBy: { year: "desc" } },
            },
          },
          facility: true,
          section: true,
        },
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

  const ymd = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : "";
  const canEditProfile =
    canManagePersonnel(user.designation) || user.id === person.id;

  // Profile picture + per-education-entry document attachments.
  const eduIds = (p?.educationEntries ?? []).map((e) => e.id);
  const [avatar, eduAttachments] = await Promise.all([
    p
      ? prisma.attachment.findFirst({
          where: { ownerType: "PersonnelProfile", ownerId: p.id, kind: "AVATAR" },
          orderBy: { createdAt: "desc" },
        })
      : null,
    eduIds.length
      ? prisma.attachment.findMany({
          where: { ownerType: "EducationEntry", ownerId: { in: eduIds } },
        })
      : [],
  ]);
  const avatarId = avatar?.id ?? null;
  const eduAttByEntry = new Map<string, { degree?: string; transcript?: string }>();
  for (const a of eduAttachments) {
    const cur = eduAttByEntry.get(a.ownerId) ?? {};
    if (a.kind === "DEGREE") cur.degree = a.id;
    else if (a.kind === "TRANSCRIPT") cur.transcript = a.id;
    eduAttByEntry.set(a.ownerId, cur);
  }

  const eduEntries = (p?.educationEntries ?? []).map((e) => ({
    id: e.id,
    degreeLevel: e.degreeLevel,
    subjects: e.subjects,
    startYear: e.startYear,
    endYear: e.endYear,
    degreeAttId: eduAttByEntry.get(e.id)?.degree ?? null,
    transcriptAttId: eduAttByEntry.get(e.id)?.transcript ?? null,
  }));
  const expEntries = (p?.experienceEntries ?? []).map((e) => ({
    company: e.company,
    designation: e.designation,
    startDate: e.startDate ? e.startDate.toISOString() : null,
    endDate: e.endDate ? e.endDate.toISOString() : null,
  }));
  const trainingEntries = (p?.trainingEntries ?? []).map((t) => ({
    title: t.title,
    year: t.year,
  }));
  const publicationEntries = (p?.publicationEntries ?? []).map((pub) => ({
    title: pub.title,
    journal: pub.journal,
    year: pub.year,
    impactFactor: pub.impactFactor,
  }));
  // Plain-text summaries to pre-fill the competence assessment basis.
  const eduSummary = eduEntries
    .map((e) => `${e.degreeLevel}${e.subjects ? ` (${e.subjects})` : ""}`)
    .join("; ");
  const expSummary = expEntries
    .map((e) => `${e.designation ? `${e.designation}, ` : ""}${e.company}`)
    .join("; ");
  const trainingSummary = trainingEntries
    .map((t) => `${t.title}${t.year ? ` (${t.year})` : ""}`)
    .join("; ");

  // Total years of experience (sum of each role's duration; open-ended = to now).
  const nowMs = Date.now();
  const experienceYears =
    Math.round(
      (p?.experienceEntries ?? []).reduce((sum, e) => {
        if (!e.startDate) return sum;
        const end = e.endDate ? e.endDate.getTime() : nowMs;
        const ms = end - e.startDate.getTime();
        return ms > 0 ? sum + ms / (365.25 * 24 * 3600 * 1000) : sum;
      }, 0) * 10,
    ) / 10;

  // Structured data used to auto-match against a function's eligibility criteria.
  const matchProfile = {
    educations: eduEntries.map((e) => ({
      degreeLevel: e.degreeLevel,
      subjects: e.subjects,
    })),
    trainings: trainingEntries.map((t) => t.title),
    experienceYears,
  };

  const profilePanel = (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4">
          {avatarId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${avatarId}`}
              alt="Profile picture"
              className="size-20 rounded-full border object-cover"
            />
          ) : (
            <div className="grid size-20 place-items-center rounded-full border bg-muted text-xs text-muted-foreground">
              No photo
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">Profile picture</p>
            {canEditProfile ? (
              <FileUploadButton
                action={uploadProfilePicture}
                hidden={{ userId: person.id }}
                label="Upload photo"
                accept="image/*"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Only managers or the user can change this.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <ProfileSection
        userId={person.id}
        email={person.email}
        canEdit={canEditProfile}
        values={{
          fullName: p?.fullName ?? "",
          title: p?.title ?? "",
          fatherName: p?.fatherName ?? "",
          dateOfBirth: ymd(p?.dateOfBirth),
          cnic: p?.cnic ?? "",
          contactNumber: p?.contactNumber ?? "",
          bloodGroup: p?.bloodGroup ?? "",
          emergencyContact: p?.emergencyContact ?? "",
          emergencyContactName: p?.emergencyContactName ?? "",
          emergencyContactRelation: p?.emergencyContactRelation ?? "",
          dateOfJoining: ymd(p?.dateOfJoining),
          skills: p?.skills ?? "",
        }}
      />
      <EducationSection userId={person.id} canEdit={canEditProfile} entries={eduEntries} />
      <ExperienceSection userId={person.id} canEdit={canEditProfile} entries={expEntries} />
      <TrainingSection userId={person.id} canEdit={canEditProfile} entries={trainingEntries} />
      <PublicationSection
        userId={person.id}
        canEdit={canEditProfile}
        entries={publicationEntries}
      />
    </div>
  );

  const competencePanel = (
    <Card>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Function</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Valid until</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competences.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-mono text-xs">{c.function.code}</div>
                  <div className="text-sm">{c.function.name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={c.competent ? "default" : "destructive"}>
                    {c.competent ? "Competent" : "Not Competent"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                  {c.remarks || c.result || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.validUntil ? formatDate(c.validUntil) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {competences.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
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
              requiredEducation: f.requiredEducation,
              requiredFields: f.requiredFields,
              requiredTrainings: f.requiredTrainings,
              minExperienceYears: f.minExperienceYears,
            }))}
            match={matchProfile}
            defaults={{
              education: eduSummary,
              experience: expSummary,
              training: trainingSummary,
              skills: p?.skills,
            }}
          />
        )}
      </CardContent>
    </Card>
  );

  const authorizationPanel = (
    <Card>
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
                  {a.expiresAt ? formatDate(a.expiresAt) : "—"}
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
              <DateInput id="expiresAt" name="expiresAt" />
            </div>
            <Button size="sm" type="submit">
              Grant (COO)
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );

  // Job Description — derived from active authorizations (SSOT §6).
  const jobDescriptionPanel = (
    <Card>
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
  );

  const tabs: TabItem[] = [
    { key: "profile", label: "Profile", content: profilePanel },
    {
      key: "competence",
      label: "Competence",
      badge: competences.length,
      content: competencePanel,
    },
    {
      key: "authorization",
      label: "Authorization",
      badge: authorizations.length,
      content: authorizationPanel,
    },
    {
      key: "jobDescription",
      label: "Job Description",
      badge: jobDescription.length,
      content: jobDescriptionPanel,
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {avatarId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${avatarId}`}
              alt=""
              className="size-12 rounded-full border object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold">
              {[p?.title, p?.fullName].filter(Boolean).join(" ") || person.email}
            </h1>
            <p className="text-sm text-muted-foreground">
              {designationLabel(person.designation)}
            </p>
          </div>
        </div>
        <Badge>{person.status}</Badge>
      </div>

      {canApprove && (
        <form action={approveProfile}>
          <input type="hidden" name="userId" value={person.id} />
          <Button type="submit">Approve &amp; activate (COO)</Button>
        </form>
      )}

      <Tabs tabs={tabs} defaultTab="profile" />
    </div>
  );
}
