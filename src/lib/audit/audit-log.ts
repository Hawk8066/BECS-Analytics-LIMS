import { prisma } from "@/lib/db";
import type { AuditAction, Prisma } from "@prisma/client";

// Immutable audit log (SSOT §13, BR-5). Append-only: this writer is the only
// sanctioned path; there are intentionally no update/delete helpers.
export interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  facilityId?: string | null;
  sectionId?: string | null;
}

export async function writeAudit(input: AuditInput) {
  return prisma.auditLog.create({ data: input });
}
