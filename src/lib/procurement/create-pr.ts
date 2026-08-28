import { revalidatePath } from "next/cache";
import type { ItemCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";
import { pathForCategory } from "@/lib/procurement/path";
import type { SessionUser } from "@/lib/auth/session";

// A requisition line before persistence — `path` is derived from the category.
export interface PRLineInput {
  description: string;
  category: ItemCategory;
  quantity?: number;
  packSize?: string | null;
  unit?: string | null;
  specification?: string | null;
  justification?: string | null;
  priority?: string | null;
}

// Shared PR creation: number it, persist the lines (each with its derived path),
// audit and revalidate. Used by the requisition form (createPR) and the reorder
// flow (createReorderPR). Callers handle their own redirect.
export async function createPRFromLines(
  actor: SessionUser,
  lines: PRLineInput[],
  note?: string | null,
  // A PR raised *about* another record — an equipment repair, say — belongs to
  // that record's lab, not to whoever is typing: a COO in Lahore raising a
  // repair for an RYK asset must produce an RYK PR, or the RYK Lab Manager who
  // has to verify it never sees it. Defaults to the actor's own scope.
  scope?: { facilityId: string; sectionId: string },
): Promise<{ id: string; prNo: string }> {
  const facilityId = scope?.facilityId ?? actor.facilityId;
  const sectionId = scope?.sectionId ?? actor.sectionId;
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  });
  if (!facility) throw new Error("That lab no longer exists.");
  const year = new Date().getFullYear();
  const prNo = await nextNumber({
    key: `PR:${facility.code}:${year}`,
    prefix: `PR-${facility.code}`,
    year,
    pad: 5,
  });

  const pr = await prisma.purchaseRequest.create({
    data: {
      prNo,
      requestedById: actor.id,
      note: note?.trim() || null,
      facilityId,
      sectionId,
      lines: {
        create: lines.map((l) => ({
          description: l.description,
          specification: l.specification ?? null,
          category: l.category,
          path: pathForCategory(l.category),
          packSize: l.packSize ?? null,
          quantity: l.quantity ?? 1,
          unit: l.unit ?? null,
          justification: l.justification ?? null,
          priority: l.priority ?? null,
        })),
      },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "PurchaseRequest",
    entityId: pr.id,
    after: { prNo, lines: lines.length },
    facilityId,
    sectionId,
  });

  // Revalidation only makes sense inside a request; this helper is also called
  // from scripts, where it would otherwise throw after the writes have landed.
  try {
    revalidatePath("/app/procurement");
  } catch {
    // not in a request scope — nothing to revalidate
  }
  return { id: pr.id, prNo };
}
