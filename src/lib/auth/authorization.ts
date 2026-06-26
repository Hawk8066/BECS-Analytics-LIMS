import { prisma } from "@/lib/db";

// Two-tier authorization (SSOT §6).
//
// Tier 1 — role/designation permissions: may the user reach a screen/action at all.
// Tier 2 — per-Function capability gating: is the user authorized for THIS function,
//          valid and non-expired as of the relevant date.

/** Tier 1: does the user hold a role granting `permissionKey`? */
export async function hasPermission(
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  const count = await prisma.userRole.count({
    where: {
      userId,
      role: { permissions: { some: { permission: { key: permissionKey } } } },
    },
  });
  return count > 0;
}

/**
 * Tier 2: is the user authorized for `functionCode`, with an ACTIVE, in-window
 * authorization as of `asOf`? Validity is evaluated at action time AND as of the
 * test date (BR-2, BR-13).
 */
export async function isAuthorizedForFunction(
  userId: string,
  functionCode: string,
  asOf: Date = new Date(),
): Promise<boolean> {
  const auth = await prisma.authorization.findFirst({
    where: {
      subjectId: userId,
      function: { code: functionCode },
      status: "ACTIVE",
      effectiveAt: { lte: asOf },
      OR: [{ expiresAt: null }, { expiresAt: { gt: asOf } }],
    },
    select: { id: true },
  });
  return auth !== null;
}

export async function assertAuthorizedForFunction(
  userId: string,
  functionCode: string,
  asOf?: Date,
): Promise<void> {
  if (!(await isAuthorizedForFunction(userId, functionCode, asOf))) {
    throw new Error(
      `Not authorized: user ${userId} lacks function ${functionCode}`,
    );
  }
}
