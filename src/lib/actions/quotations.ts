"use server";

import { revalidatePath } from "next/cache";
import type { PricePriority } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageQuotations } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { priceAt } from "@/lib/pricing";

export type FormState = { error?: string };

// Create a client quotation for testing. Prices are snapshotted from the
// selected sector's parameter/package prices so the quote is immutable.
export async function createQuotation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageQuotations(actor.designation))
    return { error: "Not permitted to create quotations." };

  const clientId = String(formData.get("clientId") ?? "");
  const priority: PricePriority =
    String(formData.get("priority")) === "URGENT" ? "URGENT" : "NORMAL";
  if (!clientId) return { error: "Select a client." };

  const validRaw = String(formData.get("validUntil") ?? "");
  const validUntil = validRaw ? new Date(validRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const sampleType = String(formData.get("sampleType") ?? "").trim() || null;
  const qtyRaw = parseInt(String(formData.get("sampleQty") ?? "1"), 10);
  const sampleQty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;

  const parameterIds = formData.getAll("parameterIds").map(String).filter(Boolean);
  const packageIds = formData.getAll("packageIds").map(String).filter(Boolean);
  if (parameterIds.length === 0 && packageIds.length === 0)
    return { error: "Select at least one parameter or package." };

  // Sector is a client attribute (classification), recorded on the quote for
  // reference — it no longer drives price.
  const [client, params, packages] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { sector: true } }),
    parameterIds.length
      ? prisma.parameter.findMany({
          where: { id: { in: parameterIds } },
          select: { id: true, name: true, matrix: true, price: true, urgentPrice: true },
        })
      : [],
    packageIds.length
      ? prisma.package.findMany({
          where: { id: { in: packageIds } },
          select: { id: true, name: true, price: true, urgentPrice: true },
        })
      : [],
  ]);
  const sector = client?.sector ?? null;

  // Snapshot at the same effective price the form showed: the explicit urgent
  // rate where set, otherwise normal + uplift (priceAt is the single rule).
  const rate = (row: { price: number | null; urgentPrice: number | null }) =>
    priceAt({ normal: row.price, urgent: row.urgentPrice }, priority) ?? 0;

  // Per-row discount (rupees) from the form, keyed by kind + id, each clamped to
  // that line's price. Discounting is per line — there is no quote-level total.
  const lineDiscount = (field: string, price: number) => {
    const raw = Number(String(formData.get(field) ?? "").trim());
    return Number.isFinite(raw) && raw > 0 ? Math.min(price, Math.round(raw * 100)) : 0;
  };

  const items = [
    ...params.map((p) => {
      const price = rate(p);
      return {
        kind: "PARAMETER",
        refId: p.id,
        name: p.matrix ? `${p.name} (${p.matrix})` : p.name,
        price,
        discount: lineDiscount(`discount_PARAMETER_${p.id}`, price),
      };
    }),
    ...packages.map((pk) => {
      const price = rate(pk);
      return {
        kind: "PACKAGE",
        refId: pk.id,
        name: pk.name,
        price,
        discount: lineDiscount(`discount_PACKAGE_${pk.id}`, price),
      };
    }),
  ];
  // subtotal is per-sample gross; the net scales by sample quantity, then a
  // services tax is added to reach the payable total.
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const perSample = items.reduce((s, i) => s + (i.price - i.discount), 0);
  const netTotal = perSample * sampleQty;
  const allowedTax = [0, 5, 15, 16];
  const taxRaw = parseInt(String(formData.get("taxPct") ?? "0"), 10);
  const taxPct = allowedTax.includes(taxRaw) ? taxRaw : 0;
  const total = netTotal + Math.round((netTotal * taxPct) / 100);
  // Quote-level discount is retired in favour of per-line; keep the columns NONE.
  const discountKind = "NONE" as const;
  const discountValue = 0;

  // Number: BECS/<year>/Quotation/<NNNN>.
  const year = new Date().getFullYear();
  const seq = await prisma.sequence.upsert({
    where: { key: "QUOTATION" },
    update: { counter: { increment: 1 } },
    create: { key: "QUOTATION", prefix: "BECS/Quotation", counter: 1 },
  });
  const quoteNo = `BECS/${year}/Quotation/${String(seq.counter).padStart(4, "0")}`;

  const quote = await prisma.testQuotation.create({
    data: {
      quoteNo,
      clientId,
      sector,
      sampleType,
      sampleQty,
      priority,
      taxPct,
      validUntil,
      note,
      subtotal,
      discountKind: discountKind === "NONE" ? "NONE" : discountKind,
      discountValue,
      total,
      createdById: actor.id,
      items: { create: items },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "TestQuotation",
    entityId: quote.id,
    after: { quoteNo, items: items.length, subtotal, total, sampleQty, priority },
  });

  revalidatePath("/app/quotations");
  redirect(`/app/quotations/${quote.id}`);
}

// Update a quotation's status (Draft → Sent → Accepted/Rejected).
export async function setQuotationStatus(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageQuotations(actor.designation))
    throw new Error("Not permitted.");

  const id = String(formData.get("quotationId"));
  const status = String(formData.get("status"));
  if (!["DRAFT", "SENT", "ACCEPTED", "REJECTED"].includes(status))
    throw new Error("Invalid status.");

  await prisma.testQuotation.update({ where: { id }, data: { status } });
  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "TestQuotation",
    entityId: id,
    after: { status },
  });
  revalidatePath(`/app/quotations/${id}`);
}
