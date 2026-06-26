import type { Designation } from "@prisma/client";

// Blinding (SSOT §8, ADR-0002): analysts, OM, COO and the Lab Manager work on
// coded sample IDs only. Client identity is revealed (decoded) to the Liaison
// Officer after COO approval. Until full decode-on-approval is wired, the LO is
// the only role permitted to see client identity in sample views.
export function canSeeClientIdentity(designation: Designation): boolean {
  return designation === "LIAISON_OFFICER";
}
