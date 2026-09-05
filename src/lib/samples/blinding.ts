import type { Designation } from "@prisma/client";
import { hasCapability } from "@/lib/auth/capability-store";

// Blinding (SSOT §8, ADR-0002): analysts, OM, COO and the Lab Manager work on
// coded sample IDs only. Client identity is revealed (decoded) to the Liaison
// Officer after COO approval. Until full decode-on-approval is wired, identity
// visibility is designation-based — the "seeClientIdentity" capability, which
// defaults to the LO alone and is re-assignable from Admin › Roles.
export function canSeeClientIdentity(designation: Designation): boolean {
  return hasCapability("seeClientIdentity", designation);
}
