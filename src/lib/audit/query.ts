import { prisma } from "@/lib/db";
import { readScope } from "@/lib/db/scope";
import type { SessionUser } from "@/lib/auth/session";

// Reusable scoped audit-log reader. Every module's writeAudit() entries flow
// here, so the Activity Log and per-module log views share one query path.
export async function getAuditLogs(
  user: SessionUser,
  opts: { entityTypes?: string[]; take?: number } = {},
) {
  return prisma.auditLog.findMany({
    where: {
      ...readScope(user),
      ...(opts.entityTypes ? { entityType: { in: opts.entityTypes } } : {}),
    },
    include: { actor: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
  });
}

// Entity types written by the Personnel module (Module 01).
export const PERSONNEL_ENTITIES = [
  "User",
  "PersonnelProfile",
  "Function",
  "CompetenceEvaluation",
  "Authorization",
  "Attendance",
  "LeaveApplication",
  "ImpartialityUndertaking",
];
