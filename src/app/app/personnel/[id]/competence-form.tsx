"use client";

import { useActionState, useMemo, useState } from "react";
import { recordCompetenceBulk, type FormState } from "@/lib/actions/authorization";
import { Button } from "@/components/ui/button";

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

// Degree levels are ranked so a higher qualification satisfies a lower
// requirement (a PhD meets an "MS/BS or above" bar). Function criteria are
// imported as free text (e.g. "PhD/MS/M.Phil./BS/B.Sc (Chemistry…)"), so we
// match by token rather than exact string equality.
const DEGREE_RANK: { rank: number; tokens: string[] }[] = [
  { rank: 3, tokens: ["phd", "ph.d", "doctor", "d.phil"] },
  { rank: 2, tokens: ["master", "ms", "m.s", "msc", "m.sc", "mphil", "m.phil"] },
  { rank: 1, tokens: ["bachelor", "bs", "b.s", "bsc", "b.sc", "b.e", "be ", "b.tech"] },
];

function degreeRank(level: string): number {
  const l = level.toLowerCase();
  for (const d of DEGREE_RANK) if (d.tokens.some((t) => l.includes(t.trim()))) return d.rank;
  return 0;
}

// Lowest degree the requirement will accept (it lists all acceptable options).
function requiredMinRank(req: string): number {
  const l = req.toLowerCase();
  const ranks = DEGREE_RANK.filter((d) => d.tokens.some((t) => l.includes(t.trim()))).map(
    (d) => d.rank,
  );
  return ranks.length ? Math.min(...ranks) : 0;
}

// Training titles are also imported as free text (e.g. a required
// "ISO 17025 Awareness & Implementation" vs a recorded "ISO/IEC 17025
// Awareness"). Exact/substring comparison misses these, so we match on the
// distinguishing keywords — dropping generic tokens shared by every ISO course
// (iso, iec, the standard number) so "Awareness" ≠ "Assessor".
const TRAINING_STOPWORDS = new Set([
  "and", "of", "the", "for", "to", "in", "on", "with", "a", "an",
]);
const TRAINING_GENERIC = new Set(["iso", "iec", "standard", "training", "course"]);

function trainingTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !TRAINING_STOPWORDS.has(t));
}

// Distinguishing tokens = drop generics + bare standard numbers (e.g. 17025).
function trainingKeywords(s: string): string[] {
  return trainingTokens(s).filter(
    (t) => !TRAINING_GENERIC.has(t) && !/^\d{4,6}$/.test(t),
  );
}

// A required training is "present" if some recorded training shares a
// distinguishing keyword with it (or, if it has none, any token at all).
function hasTraining(required: string, recorded: string[]): boolean {
  const reqKw = new Set(trainingKeywords(required));
  if (reqKw.size === 0) {
    const reqAll = new Set(trainingTokens(required));
    return recorded.some((r) => trainingTokens(r).some((t) => reqAll.has(t)));
  }
  return recorded.some((r) => trainingKeywords(r).some((t) => reqKw.has(t)));
}

// Compare the person's profile against a function's eligibility criteria.
function evaluate(
  fn: FunctionCriteria,
  prof: MatchProfile,
): { competent: boolean; checks: Check[] } {
  const checks: Check[] = [];

  if (fn.requiredEducation.length) {
    // Lowest acceptable rank across all requirement strings.
    const reqRanks = fn.requiredEducation.map(requiredMinRank).filter((r) => r > 0);
    const minReq = reqRanks.length ? Math.min(...reqRanks) : 0;
    const best = prof.educations.reduce((m, e) => Math.max(m, degreeRank(e.degreeLevel)), 0);
    const bestName =
      prof.educations
        .filter((e) => degreeRank(e.degreeLevel) === best && best > 0)
        .map((e) => e.degreeLevel)[0] ?? null;
    // If we can't parse a required rank, don't block — the criteria are free text.
    const ok = minReq === 0 ? best > 0 || prof.educations.length > 0 : best >= minReq;
    checks.push({
      label: "Education",
      ok,
      detail: ok
        ? bestName
          ? `has ${bestName}`
          : "on file"
        : best > 0
          ? `has ${bestName}, needs ${fn.requiredEducation.join(" / ")}`
          : `needs ${fn.requiredEducation.join(" / ")}`,
    });
  }

  if (fn.requiredFields.length) {
    // "Any relevant field" is an open catch-all the source criteria attach to
    // most functions; a concrete subject match is preferred but the catch-all
    // still passes anyone with a subject on file.
    const CATCH_ALL = "any relevant field";
    const concrete = fn.requiredFields.filter((f) => f.toLowerCase() !== CATCH_ALL);
    const catchAll = fn.requiredFields.some((f) => f.toLowerCase() === CATCH_ALL);
    const matched = prof.educations.find(
      (e) =>
        e.subjects &&
        concrete.some((f) => e.subjects!.toLowerCase().includes(f.toLowerCase())),
    );
    const hasSubject = prof.educations.some((e) => e.subjects);
    const ok = !!matched || (catchAll && hasSubject);
    checks.push({
      label: "Subject",
      ok,
      detail: matched
        ? `matched ${matched.subjects}`
        : catchAll && hasSubject
          ? "any relevant field"
          : concrete.length
            ? `needs ${concrete.slice(0, 3).join(" / ")}${concrete.length > 3 ? " …" : ""}`
            : "needs a relevant subject",
    });
  }

  if (fn.requiredTrainings.length) {
    const missing = fn.requiredTrainings.filter(
      (rt) => !hasTraining(rt, prof.trainings),
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

type Choice = "true" | "false" | "skip";

function DecisionRadio({
  functionId,
  value,
  onChange,
}: {
  functionId: string;
  value: Choice;
  onChange: (v: Choice) => void;
}) {
  const opts: { v: Choice; label: string; on: string }[] = [
    { v: "true", label: "Competent", on: "border-green-400 bg-green-50 text-green-800" },
    { v: "false", label: "Not Competent", on: "border-red-400 bg-red-50 text-red-800" },
    { v: "skip", label: "Skip", on: "border-slate-300 bg-slate-100 text-slate-600" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <label
            key={o.v}
            className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? o.on : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <input
              type="radio"
              name={`decision_${functionId}`}
              value={o.v}
              checked={active}
              onChange={() => onChange(o.v)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
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
    recordCompetenceBulk,
    {},
  );
  const validYear = new Date().getFullYear();

  // Auto-match every function once; the assessor's radio choice overrides it.
  const evaluated = useMemo(
    () => functions.map((fn) => ({ fn, ...evaluate(fn, match) })),
    [functions, match],
  );

  // Default each row to its auto-match decision; assessor can change or skip.
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      evaluated.map((e) => [e.fn.id, e.competent ? "true" : "false"]),
    ),
  );

  const setChoice = (id: string, v: Choice) =>
    setChoices((c) => ({ ...c, [id]: v }));
  const setAll = (v: Choice) =>
    setChoices(Object.fromEntries(functions.map((f) => [f.id, v])));

  const selectedCount = Object.values(choices).filter((v) => v !== "skip").length;

  return (
    <form action={formAction} className="grid gap-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          New competence assessment
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {functions.length} approved function{functions.length === 1 ? "" : "s"} ·
            decision defaults from criteria
          </span>
        </p>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setAll("true")}
            className="rounded border px-2 py-1 text-muted-foreground hover:bg-muted"
          >
            All competent
          </button>
          <button
            type="button"
            onClick={() => setAll("skip")}
            className="rounded border px-2 py-1 text-muted-foreground hover:bg-muted"
          >
            Skip all
          </button>
        </div>
      </div>

      <input type="hidden" name="subjectId" value={subjectId} />
      {/* Basis snapshot auto-filled from profile, applied to every row. */}
      <input type="hidden" name="education" value={defaults?.education ?? ""} />
      <input type="hidden" name="experience" value={defaults?.experience ?? ""} />
      <input type="hidden" name="training" value={defaults?.training ?? ""} />
      <input type="hidden" name="skills" value={defaults?.skills ?? ""} />
      <input type="hidden" name="validUntil" value={`${validYear}-12-31`} />

      {functions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approved functions to assess.
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {evaluated.map(({ fn, competent, checks }) => {
            const choice = choices[fn.id] ?? "skip";
            return (
              <div
                key={fn.id}
                className={`grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-start ${
                  choice === "skip" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">
                    {fn.code}
                  </div>
                  <div className="text-sm font-medium">{fn.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground">
                      Auto: {competent ? "Competent" : "Not Competent"}
                    </span>
                    {checks.map((c) => (
                      <span
                        key={c.label}
                        className={c.ok ? "text-green-700" : "text-red-700"}
                      >
                        {c.ok ? "✓" : "✗"} {c.label}
                      </span>
                    ))}
                  </div>
                  {choice !== "skip" && (
                    <input
                      type="text"
                      name={`remarks_${fn.id}`}
                      placeholder="Remarks (optional)"
                      className="mt-2 h-8 w-full rounded-md border bg-transparent px-2 text-xs"
                    />
                  )}
                </div>
                <DecisionRadio
                  functionId={fn.id}
                  value={choice}
                  onChange={(v) => setChoice(fn.id, v)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || selectedCount === 0}>
          {pending
            ? "Saving…"
            : `Record ${selectedCount} assessment${selectedCount === 1 ? "" : "s"}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Valid until 31/12/{validYear}
        </span>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
