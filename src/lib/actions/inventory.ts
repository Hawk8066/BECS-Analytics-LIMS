"use server";

import { revalidatePath } from "next/cache";
import type { StockStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/audit/audit-log";
import { isAdmin } from "@/lib/auth/perms";
import { isLabOnly } from "@/lib/inventory";

const VALID: StockStatus[] = ["OK", "LOW", "END"];

// Any active user (any lab) may report an item's stock level. Management users
// are limited to the non-lab registers (Lab Supplies & PPEs, Stationery, Store
// Items).
export async function setStockStatus(formData: FormData): Promise<void> {
  const actor = await requireUser();

  const itemId = String(formData.get("itemId"));
  const status = String(formData.get("status")) as StockStatus;
  if (!VALID.includes(status)) throw new Error("Invalid stock status.");

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { id: true, category: true, name: true, facilityId: true },
  });
  if (!item) throw new Error("Item not found.");

  // ADMIN bypasses every Tier-1 gate (perms.ts); everyone else in a MANAGEMENT
  // section is blocked from the lab registers.
  if (isLabOnly(item.category) && !isAdmin(actor.designation)) {
    const section = await prisma.section.findUnique({
      where: { id: actor.sectionId },
      select: { type: true },
    });
    if (section?.type === "MANAGEMENT")
      throw new Error("Management users cannot update lab stock.");
  }

  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      stockStatus: status,
      stockMarkedById: actor.id,
      stockMarkedAt: new Date(),
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "InventoryItem",
    entityId: itemId,
    after: { name: item.name, stockStatus: status },
    facilityId: item.facilityId,
  });

  revalidatePath("/app/inventory");
}
