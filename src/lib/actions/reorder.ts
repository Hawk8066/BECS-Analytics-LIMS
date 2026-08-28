"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { writeAudit } from "@/lib/audit/audit-log";

// Bulk issue request from the reorder UI: move several items from the main
// store to a destination store, one IssueRequest per line. Reads a shared
// `toStoreId` plus parallel `description[]` / `quantity[]` for the ticked items.
export async function requestIssues(formData: FormData): Promise<void> {
  const actor = await requireUser();

  const toStoreId = String(formData.get("toStoreId") || "");
  if (!toStoreId) throw new Error("Select a destination store.");

  const main = await prisma.store.findFirst({ where: { type: "MAIN" } });
  if (!main) throw new Error("Main store not configured.");
  if (toStoreId === main.id)
    throw new Error("Choose a store other than the main store.");

  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);

  const data = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    const quantity = parseInt(quantities[i] || "0", 10) || 0;
    if (!description || quantity <= 0) continue;
    data.push({
      requestedById: actor.id,
      fromStoreId: main.id,
      toStoreId,
      description,
      quantity,
      facilityId: actor.facilityId,
    });
  }
  if (data.length === 0)
    throw new Error("Add at least one item with a quantity.");

  await prisma.issueRequest.createMany({ data });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "IssueRequest",
    entityId: toStoreId,
    after: { count: data.length, toStoreId, from: "main store" },
    facilityId: actor.facilityId,
  });
  revalidatePath(`/app/inventory/${toStoreId}`);
  revalidatePath("/app/inventory");
}

// The chain's transfer arm: a sub-store is short of an item the main store still
// holds — request the shortfall from the main store (an ordinary issue request).
export async function requestFromMain(formData: FormData): Promise<void> {
  const actor = await requireUser();

  const toStoreId = String(formData.get("toStoreId"));
  const description = String(formData.get("description") || "").trim();
  const quantity = parseInt(String(formData.get("quantity") || "0"), 10) || 0;
  if (!toStoreId || !description || quantity <= 0)
    throw new Error("Transfer store, item and quantity are required.");

  const main = await prisma.store.findFirst({ where: { type: "MAIN" } });
  if (!main) throw new Error("Main store not configured.");

  const req = await prisma.issueRequest.create({
    data: {
      requestedById: actor.id,
      fromStoreId: main.id,
      toStoreId,
      description,
      quantity,
      facilityId: actor.facilityId,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "IssueRequest",
    entityId: req.id,
    after: { description, quantity, from: "main store" },
    facilityId: actor.facilityId,
  });
  revalidatePath("/app/inventory");
}
