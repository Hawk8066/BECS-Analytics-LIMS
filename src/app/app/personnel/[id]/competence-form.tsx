"use client";

import { useActionState, useMemo, useState } from "react";
import { recordCompetence, type FormState } from "@/lib/actions/authorization";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CompetenceDefaults {
  education?: string | null;
  experience?: string | null;
  training?: string | null;
  skills?: string | null;
}

export interface FunctionCriteria {
  id: string;
  code: string;
  name: string;
  requiredEducation: string[];
  requiredFields: string[];
  requiredTrainings: string[];
  minExperienceYears: number | null;
}

export interface MatchProfile {
  educations: { degreeLevel: string; subjects: string | null }[];
  trainings: string[];
  experienceYears: number;
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

// Compare the person's profile against a function's eligibility criteria.
function evaluate(
  fn: FunctionCriteria | undefined,
  prof: MatchProfile,
): { competent: boolean; checks: Check[] } {
  const checks: Check[] = [];
  if (!fn) return { competent: false, checks };

  if (fn.requiredEducation.length) {
    const matched = prof.educations
      .filter((e) => fn.requiredEducation.includes(e.degreeLevel))
      .map((e) => e.degreeLevel);
    checks.push({
      label: "Education",
      ok: matched.length > 0,
      detail: matched.length
        ? `has ${[...new Set(matched)].join(", ")}`
        : `needs one of ${fn.requiredEducation.join(" / ")}`,
    });
  }

  if (fn.requiredFields.length) {
    const matched = prof.educations.find(
      (e) =>
        e.subjects &&
        fn.requiredFields.some((f) =>
          e.subjects!.toLowerCase().includes(f.toLowerCase()),
        ),
    );
    checks.push({
      label: "Subject",
      ok: !!matched,
      detail: matched
        ? `matched "${matched.subjects}"`
        : `needs one of ${fn.requiredFields.join(" / ")}`,
    });
  }

  if (fn.requiredTrainings.length) {
    const missing = fn.requiredTrainings.filter(
      (rt) =>
        !prof.trainings.some((t) => t.toLowerCase().includes(rt.toLowerCase())),
    );
    checks.push({
      label: "Training",
      ok: missing.length === 0,
      detail: missing.length ? `missing: ${missing.join(", ")}` : "all present",
    });
  }

  if (fn.minExperienceYears != null) {
    checks.push({
      label: "Experience",
      ok: prof.experienceYears >= fn.minExperienceYears,
      detail: `${prof.experienceYears} / ${fn.minExperienceYears} yrs`,
    });
  }

  const competent = checks.length === 0 ? true : checks.every((c) => c.ok);
  return { competent, checks };
}

export function CompetenceForm({
  subjectId,
  functions,
  defaults,
  match,
}: {
  subjectId: string;
  functions: FunctionCriteria[];
  defaults?: CompetenceDefaults;
  match: MatchProfile;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordCompetence,
    {},
  );

  const [functionId, setFunctionId] = useState("");

  const selected = functions.find((f) => f.id === functionId);
  const result = useMemo(() => evaluate(selected, match), [selected, match]);
  const hasCriteria = result.checks.length > 0;
  // Decision is fully derived from the criteria match (read-only).
  const competent = result.competent;
  const validYear = new Date().getFullYear();

  return (
    <form action={formAction} className="grid gap-4 border-t pt-4">
      <p className="text-sm font-medium">New competence assessment</p>
      <input type="hidden" name="subjectId" value={subjectId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="functionId">Function</Label>
          <select
            id="functionId"
            name="functionId"
            required
            value={functionId}
            onChange={(e) => setFunctionId(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="" disabled>
              Select…
            </option>
            {functions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>
            Decision{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (auto from criteria)
            </span>
          </Label>
          <input type="hidden" name="competent" value={competent ? "true" : "false"} />
          <div
            className={`flex h-9 items-center rounded-md border px-3 text-sm font-medium ${
              !functionId
                ? "text-muted-foreground"
                : competent
                  ? "border-green-300 bg-green-50 text-green-800"
                  : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {!functionId ? "Select a function" : competent ? "Competent" : "Not Competent"}
          </div>
        </div>
      </div>

      {/* Auto-match breakdown */}
      {functionId && (
        <div
          className={`rounded-md border p-3 text-sm ${
            result.competent
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="mb-1 font-medium">
            Auto-match:{" "}
            {hasCriteria
              ? result.competent
                ? "Meets all criteria → Competent"
                : "Does not meet all criteria → Not Competent"
              : "No criteria defined for this function → defaults to Competent"}
          </div>
          {hasCriteria && (
            <ul className="space-y-0.5">
              {result.checks.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span className={c.ok ? "text-green-700" : "text-red-700"}>
                    {c.ok ? "✓" : "✗"}
                  </span>
                  <span className="font-medium">{c.label}:</span>
                  <span className="text-muted-foreground">{c.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Profile experience on file: {match.experienceYears} yrs. You can
            override the decision above.
          </p>
        </div>
      )}

      {/* Basis snapshot kept on the record but not shown (auto-filled from profile). */}
      <input type="hidden" name="education" value={defaults?.education ?? ""} />
      <input type="hidden" name="experience" value={defaults?.experience ?? ""} />
      <input type="hidden" name="training" value={defaults?.training ?? ""} />
      <input type="hidden" name="skills" value={defaults?.skills ?? ""} />

      <div className="grid gap-1.5">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" name="remarks" rows={2} />
      </div>

      {/* Validity is fixed to 31 Dec of the current year. */}
      <input type="hidden" name="validUntil" value={`${validYear}-12-31`} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Record assessment"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Valid until 31/12/{validYear}
        </span>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
