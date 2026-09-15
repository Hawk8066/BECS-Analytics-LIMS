"use server";

import { revalidatePath } from "next/cache";
import { InventoryCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageStore } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

const VALID_CATEGORIES = Object.values(InventoryCategory) as string[];

// Add a stock item to a store (the main store). Store In-charge only.
export async function addInventoryItem(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStore(actor.designation))
    throw new Error("Only the Store In-charge can add stock.");

  const storeId = String(formData.get("storeId"));
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Store not found.");

  const category = String(formData.get("category") || "");
  if (!VALID_CATEGORIES.includes(category)) throw new Error("Select a category.");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required.");

  const quantityRaw = String(formData.get("quantity") || "").trim();
  const thresholdRaw = String(formData.get("reorderLevel") || "").trim();
  const expiryRaw = String(formData.get("expiryDate") || "").trim();
  const accessories = formData
    .getAll("accessory")
    .map(String)
    .map((a) => a.trim())
    .filter(Boolean);

  const item = await prisma.inventoryItem.create({
    data: {
      storeId,
      facilityId: store.facilityId,
      category: category as InventoryCategory,
      name,
      pack: String(formData.get("pack") || "").trim() || null,
      unit: String(formData.get("unit") || "").trim() || null,
      specification: String(formData.get("specification") || "").trim() || null,
      accessories,
      quantity:
        quantityRaw === "" ? null : Math.max(0, parseInt(quantityRaw, 10) || 0),
      reorderLevel:
        thresholdRaw === ""
          ? null
          : Math.max(0, parseInt(thresholdRaw, 10) || 0),
      make: String(formData.get("make") || "").trim() || null,
      expiryDate: expiryRaw ? new Date(expiryRaw) : null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "InventoryItem",
    entityId: item.id,
    after: { name, category, storeId },
    facilityId: store.facilityId,
  });
  revalidatePath(`/app/inventory/${storeId}`);
}

// Bulk-set reorder thresholds for a store's items (Thresholds tab). Reads one
// `t_<itemId>` field per item; blank clears the threshold (→ global default).
// Store In-charge only. Updates only the items whose value actually changed.
export async function setThresholds(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStore(actor.designation))
    throw new Error("Only the Store In-charge can set thresholds.");

  const storeId = String(formData.get("storeId"));
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Store not found.");

  const items = await prisma.inventoryItem.findMany({
    where: { storeId },
    select: { id: true, reorderLevel: true },
  });

  const updates = [];
  for (const it of items) {
    const raw = formData.get(`t_${it.id}`);
    if (raw === null) continue; // field not submitted for this item
    const trimmed = String(raw).trim();
    const next =
      trimmed === "" ? null : Math.max(0, parseInt(trimmed, 10) || 0);
    if (next !== it.reorderLevel) {
      updates.push(
        prisma.inventoryItem.update({
          where: { id: it.id },
          data: { reorderLevel: next },
        }),
      );
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
    await writeAudit({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "InventoryItem",
      entityId: storeId,
      after: { thresholdsUpdated: updates.length, storeId },
      facilityId: store.facilityId,
    });
  }

  revalidatePath(`/app/inventory/${storeId}`);
}
