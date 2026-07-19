"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageQuotations } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";

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
  const sector = String(formData.get("sector") ?? "");
  if (!clientId) return { error: "Select a client." };
  if (!sector) return { error: "Select a sector." };

  const validRaw = String(formData.get("validUntil") ?? "");
  const validUntil = validRaw ? new Date(validRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const parameterIds = formData.getAll("parameterIds").map(String).filter(Boolean);
  const packageIds = formData.getAll("packageIds").map(String).filter(Boolean);
  if (parameterIds.length === 0 && packageIds.length === 0)
    return { error: "Select at least one parameter or package." };

  // Snapshot line items with the selected sector's prices.
  const [params, packages] = await Promise.all([
    parameterIds.length
      ? prisma.parameter.findMany({
          where: { id: { in: parameterIds } },
          include: { sectorPrices: { where: { sector } } },
        })
      : [],
    packageIds.length
      ? prisma.package.findMany({
          where: { id: { in: packageIds } },
          include: { prices: { where: { sector } } },
        })
      : [],
  ]);

  const items = [
    ...params.map((p) => ({
      kind: "PARAMETER",
      refId: p.id,
      name: p.matrix ? `${p.name} (${p.matrix})` : p.name,
      price: p.sectorPrices[0]?.price ?? 0,
    })),
    ...packages.map((pk) => ({
      kind: "PACKAGE",
      refId: pk.id,
      name: pk.name,
      price: pk.prices[0]?.price ?? 0,
    })),
  ];
  const subtotal = items.reduce((s, i) => s + i.price, 0);

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
      validUntil,
      note,
      subtotal,
      createdById: actor.id,
      items: { create: items },
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "TestQuotation",
    entityId: quote.id,
    after: { quoteNo, items: items.length, subtotal },
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
