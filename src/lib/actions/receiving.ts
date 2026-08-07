"use server";

import { revalidatePath } from "next/cache";
import {
  CheckAnswer,
  ExpiryCheck,
  type InspectionSection,
  type ReceiptStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canInspectGoods,
  canManageStore,
  canMarkReceived,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { nextNumber } from "@/lib/numbering";

const toAns = (v: FormDataEntryValue | null): CheckAnswer | null => {
  const s = String(v ?? "");
  return s in CheckAnswer ? (s as CheckAnswer) : null;
};
const toExp = (v: FormDataEntryValue | null): ExpiryCheck | null => {
  const s = String(v ?? "");
  return s in ExpiryCheck ? (s as ExpiryCheck) : null;
};

// Purchase Officer marks a delivery received against a PO (partial OK, BR-19).
export async function markReceived(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canMarkReceived(actor.designation))
    throw new Error("Not permitted to receive goods.");

  const poId = String(formData.get("poId"));
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("PO not found.");

  const receipt = await prisma.goodsReceipt.create({
    data: { poId, receivedById: actor.id },
  });
  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "GoodsReceipt",
    entityId: receipt.id,
    after: { poId },
  });
  revalidatePath(`/app/procurement/${po.prId}`);
}

// OM (Lahore) / Lab Manager (RYK) inspects a delivery against the Incoming
// Inspection Checklist (BECS/FF/606/09): records the per-section checks and an
// accept/reject decision that sets the receipt status (BR-11).
export async function submitInspection(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canInspectGoods(actor.designation))
    throw new Error("Not permitted to inspect goods.");

  const receiptId = String(formData.get("receiptId"));
  const decisionRaw = String(formData.get("decision"));
  if (decisionRaw !== "ACCEPTED" && decisionRaw !== "REJECTED")
    throw new Error("Invalid decision.");
  const decision = decisionRaw as ReceiptStatus;

  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id: receiptId },
    include: { po: { select: { prId: true } } },
  });
  if (!receipt) throw new Error("Receipt not found.");

  const text = (name: string) => String(formData.get(name) || "").trim() || null;

  // One checked row per delivered item (item_<i>_*). Section decides which
  // check fields are meaningful; the rest come back null.
  const SECTIONS = ["CHEMICAL", "EQUIPMENT", "MATERIAL"];
  const count = parseInt(String(formData.get("itemCount") || "0"), 10) || 0;
  const items: {
    poLineId: string | null;
    name: string;
    section: InspectionSection;
    specs: CheckAnswer | null;
    quantity: CheckAnswer | null;
    packing: CheckAnswer | null;
    expiry: ExpiryCheck | null;
    storage: CheckAnswer | null;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const name = String(formData.get(`item_${i}_name`) || "").trim();
    const section = String(formData.get(`item_${i}_section`) || "").toUpperCase();
    if (!name || !SECTIONS.includes(section)) continue;
    items.push({
      poLineId: String(formData.get(`item_${i}_poLineId`) || "") || null,
      name,
      section: section as InspectionSection,
      specs: toAns(formData.get(`item_${i}_specs`)),
      quantity: toAns(formData.get(`item_${i}_quantity`)),
      packing: toAns(formData.get(`item_${i}_packing`)),
      expiry: toExp(formData.get(`item_${i}_expiry`)),
      storage: toAns(formData.get(`item_${i}_storage`)),
    });
  }

  const header = {
    supplier: text("supplier"),
    notes: text("notes"),
    decision,
    inspectedById: actor.id,
  };

  await prisma.$transaction([
    prisma.incomingInspection.upsert({
      where: { goodsReceiptId: receiptId },
      update: { ...header, items: { deleteMany: {}, create: items } },
      create: { goodsReceiptId: receiptId, ...header, items: { create: items } },
    }),
    prisma.goodsReceipt.update({
      where: { id: receiptId },
      data: {
        status: decision,
        inspectedById: actor.id,
        inspectedAt: new Date(),
      },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: decision === "ACCEPTED" ? "APPROVE" : "REJECT",
    entityType: "GoodsReceipt",
    entityId: receiptId,
    after: { decision },
  });
  revalidatePath(`/app/procurement/${receipt.po.prId}`);
}

// Store In-charge issues the GRN for an accepted delivery; goods enter the main
// store (BR-11). Credits stock for each PR line.
export async function issueGRN(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStore(actor.designation))
    throw new Error("Only the Store In-charge can issue GRNs.");

  const id = String(formData.get("receiptId"));
  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id },
    include: {
      grn: true,
      po: { include: { lines: true, pr: { include: { lines: true } } } },
    },
  });
  if (!receipt) throw new Error("Receipt not found.");
  if (receipt.status !== "ACCEPTED")
    throw new Error("Delivery must be accepted before GRN.");
  if (receipt.grn) throw new Error("GRN already issued.");

  const main = await prisma.store.findFirst({ where: { type: "MAIN" } });
  if (!main) throw new Error("Main store not configured.");

  // Credit only the lines this PO covers (a PR can split across vendor POs).
  // Legacy POs have no PurchaseOrderLine rows — fall back to all PR lines.
  const creditLines =
    receipt.po.lines.length > 0 ? receipt.po.lines : receipt.po.pr.lines;

  const year = new Date().getFullYear();
  const grnNo = await nextNumber({
    key: `GRN:LHR:${year}`,
    prefix: "GRN-LHR",
    year,
    pad: 5,
  });

  await prisma.$transaction([
    prisma.gRN.create({
      data: {
        grnNo,
        goodsReceiptId: id,
        storeId: main.id,
        issuedById: actor.id,
      },
    }),
    ...creditLines.map((l) =>
      prisma.stockTransaction.create({
        data: {
          storeId: main.id,
          description: l.description,
          quantity: l.quantity,
          reason: "GRN",
          refType: "GRN",
          refId: grnNo,
        },
      }),
    ),
    prisma.purchaseOrder.update({
      where: { id: receipt.poId },
      data: { status: "RECEIVED" },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "GRN",
    entityId: grnNo,
    after: { lines: creditLines.length },
  });
  revalidatePath(`/app/procurement/${receipt.po.prId}`);
}

// Any employee requests stock be moved from the main store to a sub-store (BR-10).
export async function requestIssue(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const toStoreId = String(formData.get("toStoreId"));
  const description = String(formData.get("description") || "").trim();
  const quantity = parseInt(String(formData.get("quantity") || "0"), 10) || 0;
  if (!toStoreId || !description || quantity <= 0)
    throw new Error("Store, description and quantity are required.");

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
    after: { description, quantity },
    facilityId: actor.facilityId,
  });
  revalidatePath("/app/inventory");
}

// Store In-charge approves/rejects an issue request; approval moves the stock.
export async function decideIssue(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageStore(actor.designation))
    throw new Error("Only the Store In-charge can decide issue requests.");

  const id = String(formData.get("issueId"));
  const decision = String(formData.get("decision"));
  const issue = await prisma.issueRequest.findUnique({ where: { id } });
  if (!issue) throw new Error("Request not found.");

  if (decision === "APPROVED") {
    await prisma.$transaction([
      prisma.stockTransaction.create({
        data: {
          storeId: issue.fromStoreId,
          description: issue.description,
          quantity: -issue.quantity,
          reason: "ISSUE_OUT",
          refType: "IssueRequest",
          refId: issue.id,
        },
      }),
      prisma.stockTransaction.create({
        data: {
          storeId: issue.toStoreId,
          description: issue.description,
          quantity: issue.quantity,
          reason: "ISSUE_IN",
          refType: "IssueRequest",
          refId: issue.id,
        },
      }),
      prisma.issueRequest.update({
        where: { id },
        data: { status: "APPROVED", approvedById: actor.id, decidedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.issueRequest.update({
      where: { id },
      data: { status: "REJECTED", approvedById: actor.id, decidedAt: new Date() },
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "IssueRequest",
    entityId: id,
    after: { status: decision },
    facilityId: issue.facilityId,
  });
  revalidatePath("/app/inventory");
}
