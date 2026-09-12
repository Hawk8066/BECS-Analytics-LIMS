"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  canGeneratePO,
  canRecordQuotation,
  canSelectQuotation,
} from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { publish } from "@/lib/feed/publish";
import { nextNumber } from "@/lib/numbering";

function toPaisa(pkr: string): number {
  const n = parseFloat(pkr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Purchase Officer records a vendor quotation against an APPROVED PR (full path).
// Rates are entered per PR line (rate_<lineId> / spec_<lineId>) so the comparative
// can be produced; the quotation total = Σ(rate × qty). Re-quoting a vendor
// replaces its previous quotation.
export async function addQuotation(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canRecordQuotation(actor.designation))
    throw new Error("Not permitted to record quotations.");

  const prId = String(formData.get("prId"));
  const vendorId = String(formData.get("vendorId"));
  if (!vendorId) throw new Error("Vendor is required.");

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: true },
  });
  if (!pr || pr.status !== "APPROVED")
    throw new Error("PR must be approved before quotations.");

  const lines: { prLineId: string; specification: string | null; rate: number }[] =
    [];
  let amount = 0;
  for (const l of pr.lines) {
    const rate = toPaisa(String(formData.get(`rate_${l.id}`) || "0"));
    if (rate <= 0) continue;
    const specification =
      String(formData.get(`spec_${l.id}`) || "").trim() || null;
    lines.push({ prLineId: l.id, specification, rate });
    amount += rate * l.quantity;
  }
  if (lines.length === 0)
    throw new Error("Enter a rate for at least one item.");

  // Replace any prior quotation from this vendor (cascade drops its lines).
  const existing = await prisma.quotation.findUnique({
    where: { prId_vendorId: { prId, vendorId } },
    select: { id: true },
  });
  const q = await prisma.$transaction(async (tx) => {
    if (existing) await tx.quotation.delete({ where: { id: existing.id } });
    return tx.quotation.create({
      data: {
        prId,
        vendorId,
        amount,
        createdById: actor.id,
        lines: { create: lines },
      },
    });
  });

  await writeAudit({
    actorId: actor.id,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "Quotation",
    entityId: q.id,
    after: { prId, vendorId, amount, lines: lines.length },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${prId}`);
}

// COO awards a winning vendor per PR line on the Comparative Statement (Form 6-B).
// winner_<lineId> = the chosen QuotationLine id (blank = undecided);
// note_<lineId> = the justification for that award. A PR may split across vendors.
export async function selectComparative(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canSelectQuotation(actor.designation))
    throw new Error("Only the COO can award the comparative.");

  const prId = String(formData.get("prId"));
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: true, quotations: { include: { lines: true } } },
  });
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "APPROVED")
    throw new Error("PR must be approved to award the comparative.");

  // Valid QuotationLine ids keyed by the PR line they belong to (guards the input).
  const linesByPr = new Map<string, Set<string>>();
  for (const q of pr.quotations)
    for (const l of q.lines) {
      if (!linesByPr.has(l.prLineId)) linesByPr.set(l.prLineId, new Set());
      linesByPr.get(l.prLineId)!.add(l.id);
    }

  const winnerByPr = new Map<string, string | null>();
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const line of pr.lines) {
    const raw = String(formData.get(`winner_${line.id}`) || "");
    const winner = raw && linesByPr.get(line.id)?.has(raw) ? raw : null;
    winnerByPr.set(line.id, winner);
    const note = String(formData.get(`note_${line.id}`) || "").trim() || null;

    ops.push(
      prisma.quotationLine.updateMany({
        where: { prLineId: line.id },
        data: { selected: false },
      }),
    );
    if (winner)
      ops.push(
        prisma.quotationLine.update({
          where: { id: winner },
          data: { selected: true },
        }),
      );
    ops.push(
      prisma.pRLine.update({
        where: { id: line.id },
        data: { selectionNote: note },
      }),
    );
  }

  // Maintain the vendor-level flag: selected = this vendor won ≥ 1 line.
  for (const q of pr.quotations) {
    const wins = q.lines.some((l) => winnerByPr.get(l.prLineId) === l.id);
    ops.push(
      prisma.quotation.update({
        where: { id: q.id },
        data: { selected: wins },
      }),
    );
  }

  await prisma.$transaction(ops);
  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "PurchaseRequest",
    entityId: prId,
    after: {
      awards: [...winnerByPr.entries()].filter(([, w]) => w).length,
    },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  revalidatePath(`/app/procurement/${prId}`);
}

// Generate the PO(s): for full-path PRs, one PO per winning vendor from the
// comparative award (each PO carries only that vendor's lines); for simplified-
// only PRs, one direct PO covering all lines with a vendor + amount (BR-9).
export async function generatePO(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canGeneratePO(actor.designation))
    throw new Error("Not permitted to generate POs.");

  const prId = String(formData.get("prId"));
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: {
      lines: true,
      quotations: { include: { lines: true } },
      pos: { select: { id: true } },
    },
  });
  if (!pr) throw new Error("PR not found.");
  if (pr.status !== "APPROVED") throw new Error("PR must be approved.");
  if (pr.pos.length > 0)
    throw new Error("A purchase order already exists for this PR.");

  const facility = await prisma.facility.findUnique({
    where: { id: pr.facilityId },
  });
  if (!facility) throw new Error("Facility not found.");
  const year = new Date().getFullYear();
  const lineById = new Map(pr.lines.map((l) => [l.id, l]));

  const hasFull = pr.lines.some((l) => l.path === "FULL");

  // Each PO to create, resolved before writing so numbering + writes are grouped.
  type NewPO = {
    poNo: string;
    vendorId: string | null;
    amount: number | null;
    lines: {
      prLineId: string;
      description: string;
      packSize: string | null;
      quantity: number;
      unit: string | null;
      rate: number | null;
    }[];
  };
  const toCreate: NewPO[] = [];

  if (hasFull) {
    // Group the awarded lines by their winning vendor.
    const byVendor = new Map<string, { prLineId: string; rate: number }[]>();
    for (const q of pr.quotations)
      for (const l of q.lines)
        if (l.selected) {
          if (!byVendor.has(q.vendorId)) byVendor.set(q.vendorId, []);
          byVendor.get(q.vendorId)!.push({ prLineId: l.prLineId, rate: l.rate });
        }
    if (byVendor.size === 0)
      throw new Error("Award winning vendors on the comparative first.");

    for (const [vendorId, items] of byVendor) {
      const lines = items.map((it) => {
        const l = lineById.get(it.prLineId)!;
        return {
          prLineId: l.id,
          description: l.description,
          packSize: l.packSize,
          quantity: l.quantity,
          unit: l.unit,
          rate: it.rate,
        };
      });
      const amount = lines.reduce(
        (s, pl) => s + (pl.rate ?? 0) * pl.quantity,
        0,
      );
      const poNo = await nextNumber({
        key: `PO:${facility.code}:${year}`,
        prefix: `PO-${facility.code}`,
        year,
        pad: 5,
      });
      toCreate.push({ poNo, vendorId, amount, lines });
    }
  } else {
    const vendorId = String(formData.get("vendorId") || "") || null;
    const amount = toPaisa(String(formData.get("amount") || "0")) || null;
    if (!vendorId) throw new Error("Vendor is required.");
    const poNo = await nextNumber({
      key: `PO:${facility.code}:${year}`,
      prefix: `PO-${facility.code}`,
      year,
      pad: 5,
    });
    toCreate.push({
      poNo,
      vendorId,
      amount,
      lines: pr.lines.map((l) => ({
        prLineId: l.id,
        description: l.description,
        packSize: l.packSize,
        quantity: l.quantity,
        unit: l.unit,
        rate: null,
      })),
    });
  }

  await prisma.$transaction([
    ...toCreate.map((po) =>
      prisma.purchaseOrder.create({
        data: {
          poNo: po.poNo,
          prId,
          vendorId: po.vendorId,
          amount: po.amount,
          issuedById: actor.id,
          lines: { create: po.lines },
        },
      }),
    ),
    prisma.purchaseRequest.update({
      where: { id: prId },
      data: { status: "ORDERED" },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "PurchaseOrder",
    entityId: toCreate.map((p) => p.poNo).join(", "),
    after: { prId, count: toCreate.length },
    facilityId: pr.facilityId,
    sectionId: pr.sectionId,
  });
  await publish({
    template: "poGenerated",
    params: { poNo: toCreate.map((p) => p.poNo).join(", "), prId },
    actor,
    facilityId: pr.facilityId,
    sectionId: pr.sectionId ?? actor.sectionId,
  });
  revalidatePath(`/app/procurement/${prId}`);
}
