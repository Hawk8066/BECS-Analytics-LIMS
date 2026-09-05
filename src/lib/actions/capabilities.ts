"use server";

import { revalidatePath } from "next/cache";
import type { Designation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canAdminister } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import {
  ASSIGNABLE_DESIGNATIONS,
  CAPABILITIES,
  isDefaultSet,
} from "@/lib/auth/capabilities";
import { invalidateCapabilities } from "@/lib/auth/capability-store";

// Admin › Roles. Saves the whole matrix in one submit: each capability posts its
// ticked designations as `cap:<key>`. A capability whose set equals the built-in
// default is stored as no row at all, so "unchanged" always means "default" and
// a later change to a default automatically propagates.
export async function saveCapabilityMatrix(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canAdminister(actor.designation))
    throw new Error("Only the application admin can change role assignments.");

  const allowed = new Set<string>(ASSIGNABLE_DESIGNATIONS);
  const writes = [];
  let changed = 0;

  for (const cap of CAPABILITIES) {
    const picked = formData
      .getAll(`cap:${cap.key}`)
      .map(String)
      .filter((d) => allowed.has(d)) as Designation[];

    if (isDefaultSet(cap.key, picked)) {
      // Back to the built-in default — drop any stored override.
      writes.push(
        prisma.capabilityGrant.deleteMany({ where: { capability: cap.key } }),
      );
    } else {
      changed += 1;
      writes.push(
        prisma.capabilityGrant.upsert({
          where: { capability: cap.key },
          create: {
            capability: cap.key,
            designations: picked,
            updatedById: actor.id,
          },
          update: { designations: picked, updatedById: actor.id },
        }),
      );
    }
  }

  await prisma.$transaction(writes);
  invalidateCapabilities();

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "CapabilityGrant",
    entityId: "matrix",
    after: { customised: changed, total: CAPABILITIES.length },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/admin/roles");
  revalidatePath("/app", "layout");
}

/** Clear every override — the whole matrix reverts to the built-in defaults. */
export async function resetCapabilityMatrix(): Promise<void> {
  const actor = await requireUser();
  if (!canAdminister(actor.designation))
    throw new Error("Only the application admin can change role assignments.");

  const { count } = await prisma.capabilityGrant.deleteMany({});
  invalidateCapabilities();

  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "CapabilityGrant",
    entityId: "matrix",
    after: { reset: count },
    facilityId: actor.facilityId,
  });

  revalidatePath("/app/admin/roles");
  revalidatePath("/app", "layout");
}
