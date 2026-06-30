// Eligibility-criteria option lists for Functions (competence requirements).

export const FUNCTION_EDUCATION = [
  "Matriculation",
  "Intermediate",
  "Diploma",
  "Bachelor's",
  "Master's",
  "MPhil",
  "PhD",
];

export const FUNCTION_FIELDS = [
  "Chemistry",
  "Biochemistry",
  "Chemical Engineering",
  "Agriculture",
  "Environmental Science",
  "Biology",
  "Microbiology",
];

export const EXPERIENCE_MAX_YEARS = 50;

// 0, 0.5, 1, … up to EXPERIENCE_MAX_YEARS.
export function experienceOptions(): number[] {
  const out: number[] = [];
  for (let y = 0; y <= EXPERIENCE_MAX_YEARS; y += 0.5) out.push(y);
  return out;
}
