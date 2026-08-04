/**
 * One-off (test data): approve the pending parameters as the COO.
 *
 * The uploaded master list came in as 561 proposals, and an unapproved
 * parameter is invisible to quotations and sample booking — which is why the
 * matrix dropdown on those forms comes back empty. This approves them under the
 * COO account so the workflows can be exercised.
 *
 * This is a testing shortcut, not the real control: in production the COO
 * approves from the Parameters tab (single rows, or "Approve all"), and every
 * approval is audited to whoever clicked it. Each row approved here is audited
 * to the COO and flagged `testData: true`, so a seeded approval can always be
 * told apart from a real one.
 *
 * Re-runnable: a second run finds nothing pending.
 *   npx tsx prisma/_tmp-approve-parameters.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const coo = await prisma.user.findFirst({
    where: { designation: "COO", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  if (!coo) {
    console.log("No active COO account — aborting (approvals must have an approver).");
    return;
  }

  const pending = await prisma.parameter.findMany({
    where: { approvedAt: null },
    select: { id: true },
  });
  if (pending.length === 0) {
    console.log("Nothing pending — every parameter is already approved.");
    return;
  }

  const approvedAt = new Date();
  await prisma.$transaction([
    prisma.parameter.updateMany({ where: { approvedAt: null }, data: { approvedAt } }),
    prisma.auditLog.createMany({
      data: pending.map((p) => ({
        actorId: coo.id,
        action: "APPROVE" as const,
        entityType: "Parameter",
        entityId: p.id,
        after: { approved: true, bulk: true, testData: true },
      })),
    }),
  ]);

  const matrices = await prisma.parameter.findMany({
    where: { approvedAt: { not: null }, matrix: { not: null } },
    distinct: ["matrix"],
    select: { matrix: true },
  });

  console.log(
    `Approved ${pending.length} parameter(s) as ${coo.email}; ` +
      `${matrices.length} matrices are now selectable on the quotation and sample forms.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
