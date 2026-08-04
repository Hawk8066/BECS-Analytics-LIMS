"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { PriceChangeSource, PricePriority } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { canManageParameters, canApproveParameter } from "@/lib/auth/perms";
import { writeAudit } from "@/lib/audit/audit-log";
import { rupeesToPaisa } from "@/lib/money";

export type FormState = { error?: string; ok?: boolean };

const ParameterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().optional(),
  matrix: z.string().optional(),
  method: z.string().optional(),
  lod: z.string().optional(),
  loq: z.string().optional(),
  accredited: z.enum(["on", "true"]).optional(),
  /** PKR rupees; blank leaves that rate unpriced. */
  price: z.string().optional(),
  urgentPrice: z.string().optional(),
  /** Turnaround time in working days. */
  tatDays: z.string().optional(),
  tatUrgentDays: z.string().optional(),
});

/** Whole days from a form field; blank/invalid ⇒ null. */
function toDays(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Propose a parameter (OM / LO / Lab Manager). COO-created ones are auto-approved.
export async function createParameter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    return { error: "Not permitted to add parameters." };

  const parsed = ParameterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const matrix = d.matrix || null;
  if (await prisma.parameter.findFirst({ where: { name: d.name, matrix } }))
    return { error: "A parameter with that name and matrix already exists." };

  let price: number | null;
  let urgentPrice: number | null;
  try {
    price = rupeesToPaisa(d.price, "Price");
    urgentPrice = rupeesToPaisa(d.urgentPrice, "Urgent price");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid price." };
  }

  const approvedAt = canApproveParameter(actor.designation) ? new Date() : null;
  const p = await prisma.$transaction(async (tx) => {
    const created = await tx.parameter.create({
      data: {
        name: d.name,
        unit: d.unit || null,
        matrix,
        method: d.method || null,
        lod: d.lod || null,
        loq: d.loq || null,
        accredited: !!d.accredited,
        price,
        urgentPrice,
        tatDays: toDays(d.tatDays),
        tatUrgentDays: toDays(d.tatUrgentDays),
        createdById: actor.id,
        approvedAt,
      },
    });

    // Log each rate that was set, so the price is dated from the start.
    const entries = (
      [
        ["NORMAL", price],
        ["URGENT", urgentPrice],
      ] as const
    ).filter(([, value]) => value !== null);
    if (entries.length > 0) {
      await tx.parameterPriceHistory.createMany({
        data: entries.map(([priority, value]) => ({
          parameterId: created.id,
          priority,
          oldPrice: null,
          price: value,
          source: "MANUAL" as const,
          changedById: actor.id,
        })),
      });
    }

    return created;
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Parameter",
    entityId: p.id,
    after: { name: d.name, approved: !!approvedAt, price },
  });

  revalidatePath("/app/parameters");
  return { ok: true };
}

// PKR rupees string → paisa; "" ⇒ null (unset); throws on invalid.
function toPaisa(raw: FormDataEntryValue | null): number | null {
  return rupeesToPaisa(raw as string | null, "Price");
}

export type PriceResult = { ok: true } | { ok: false; error: string };

/** One dated entry in a parameter's price trail, as the Prices tab shows it. */
export interface PriceHistoryEntry {
  id: string;
  /** ISO; rendered DD/MM/YYYY on the page. */
  changedAt: string;
  priority: PricePriority;
  oldPrice: number | null;
  price: number | null;
  source: PriceChangeSource;
  /** Who made the change — full name, else email, else null for server jobs. */
  by: string | null;
}

/**
 * Set the same price, at one grade, on one or more parameters (empty clears it).
 * Pricing is per parameter — not per sector.
 *
 * The Prices tab's Revise popup uses this to push a new price to a test's copies
 * across matrices in one save (e.g. pH in every matrix): the same test exists as
 * a distinct Parameter per `(name, matrix)`. Each parameter that actually changes
 * gets its own dated history entry, so every copy stays traceable on its own.
 */
export async function setParametersPrice(input: {
  parameterIds: string[];
  /** Which rate is being set: the standard one or the rush one. */
  priority: PricePriority;
  /** PKR rupees as typed; "" clears that rate. */
  price: string;
}): Promise<PriceResult> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    return { ok: false, error: "Not permitted to set prices." };

  const { priority } = input;
  if (priority !== "NORMAL" && priority !== "URGENT")
    return { ok: false, error: "Unknown priority." };

  const ids = [...new Set(input.parameterIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true };

  let price: number | null;
  try {
    price = toPaisa(input.price);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid price." };
  }

  const urgent = priority === "URGENT";
  const existing = await prisma.parameter.findMany({
    where: { id: { in: ids } },
    select: { id: true, price: true, urgentPrice: true },
  });

  // Only the ones whose relevant grade actually differs — no-op saves stay out
  // of the trail.
  const changed = existing
    .map((p) => ({ id: p.id, oldPrice: (urgent ? p.urgentPrice : p.price) ?? null }))
    .filter((p) => p.oldPrice !== price);
  if (changed.length === 0) return { ok: true };

  try {
    // Prices and their history rows commit together, so the trail can never be
    // missing a change that actually happened.
    await prisma.$transaction(async (tx) => {
      await tx.parameter.updateMany({
        where: { id: { in: changed.map((c) => c.id) } },
        data: urgent ? { urgentPrice: price } : { price },
      });
      await tx.parameterPriceHistory.createMany({
        data: changed.map((c) => ({
          parameterId: c.id,
          priority,
          oldPrice: c.oldPrice,
          price,
          source: "MANUAL" as const,
          changedById: actor.id,
        })),
      });
    });
  } catch {
    return { ok: false, error: "Could not save — reload the page and try again." };
  }

  for (const c of changed) {
    await writeAudit({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "Parameter",
      entityId: c.id,
      before: { priority, price: c.oldPrice },
      after: { priority, price },
    });
  }
  revalidatePath("/app/parameters");
  return { ok: true };
}

/** Set one parameter's price at one grade — the single-target case. */
export async function setParameterPrice(input: {
  parameterId: string;
  priority: PricePriority;
  price: string;
}): Promise<PriceResult> {
  return setParametersPrice({
    parameterIds: [input.parameterId],
    priority: input.priority,
    price: input.price,
  });
}

/** The dated price trail for one parameter, newest first. */
export async function getParameterPriceHistory(
  parameterId: string,
): Promise<PriceHistoryEntry[]> {
  await requireUser(); // anyone who can open the Prices tab may read the trail

  const rows = await prisma.parameterPriceHistory.findMany({
    where: { parameterId },
    orderBy: { changedAt: "desc" },
    take: 50,
    select: {
      id: true,
      changedAt: true,
      priority: true,
      oldPrice: true,
      price: true,
      source: true,
      changedBy: { select: { email: true, profile: { select: { fullName: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    changedAt: r.changedAt.toISOString(),
    priority: r.priority,
    oldPrice: r.oldPrice,
    price: r.price,
    source: r.source,
    by: r.changedBy?.profile?.fullName ?? r.changedBy?.email ?? null,
  }));
}

// Create a package (a named bundle of selected parameters).
export async function createPackage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    return { error: "Not permitted to create packages." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Package name is required." };
  const matrix = String(formData.get("matrix") ?? "").trim() || null;
  const parameterIds = formData.getAll("parameterIds").map(String).filter(Boolean);
  if (parameterIds.length === 0)
    return { error: "Select at least one parameter." };

  let price: number | null;
  let urgentPrice: number | null;
  try {
    price = rupeesToPaisa(String(formData.get("price") ?? ""), "Price");
    urgentPrice = rupeesToPaisa(String(formData.get("urgentPrice") ?? ""), "Urgent price");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid price." };
  }

  if (await prisma.package.findUnique({ where: { name } }))
    return { error: "A package with that name already exists." };

  const pkg = await prisma.$transaction(async (tx) => {
    const created = await tx.package.create({
      data: {
        name,
        matrix,
        price,
        urgentPrice,
        createdById: actor.id,
        parameters: { create: parameterIds.map((parameterId) => ({ parameterId })) },
      },
    });
    // Log each price grade set at creation, so the trail is dated from the start.
    const entries = (
      [
        ["NORMAL", price],
        ["URGENT", urgentPrice],
      ] as const
    ).filter(([, value]) => value !== null);
    if (entries.length > 0) {
      await tx.packagePriceHistory.createMany({
        data: entries.map(([priority, value]) => ({
          packageId: created.id,
          priority,
          oldPrice: null,
          price: value,
          source: "MANUAL" as const,
          changedById: actor.id,
        })),
      });
    }
    return created;
  });

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "Package",
    entityId: pkg.id,
    after: { name, matrix, parameters: parameterIds.length, price },
  });
  revalidatePath("/app/parameters");
  return { ok: true };
}

// Set a package's price at one grade (empty clears it), logging the change to
// the dated trail exactly as parameter prices do. Priced as one bundle, not
// per sector.
export async function updatePackagePrice(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    throw new Error("Not permitted to set prices.");

  const packageId = String(formData.get("packageId"));
  const priority: PricePriority =
    String(formData.get("priority")) === "URGENT" ? "URGENT" : "NORMAL";
  const price = toPaisa(formData.get("price"));

  const existing = await prisma.package.findUnique({
    where: { id: packageId },
    select: { price: true, urgentPrice: true },
  });
  if (!existing) throw new Error("Package not found.");
  const urgent = priority === "URGENT";
  const oldPrice = (urgent ? existing.urgentPrice : existing.price) ?? null;
  if (oldPrice === price) return; // same figure — not a price change

  await prisma.$transaction(async (tx) => {
    await tx.package.update({
      where: { id: packageId },
      data: urgent ? { urgentPrice: price } : { price },
    });
    await tx.packagePriceHistory.create({
      data: { packageId, priority, oldPrice, price, source: "MANUAL", changedById: actor.id },
    });
  });

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "Package",
    entityId: packageId,
    before: { priority, price: oldPrice },
    after: { priority, price },
  });
  revalidatePath("/app/parameters");
}

/** The dated price trail for one package, newest first. */
export async function getPackagePriceHistory(
  packageId: string,
): Promise<PriceHistoryEntry[]> {
  await requireUser();

  const rows = await prisma.packagePriceHistory.findMany({
    where: { packageId },
    orderBy: { changedAt: "desc" },
    take: 50,
    select: {
      id: true,
      changedAt: true,
      priority: true,
      oldPrice: true,
      price: true,
      source: true,
      changedBy: { select: { email: true, profile: { select: { fullName: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    changedAt: r.changedAt.toISOString(),
    priority: r.priority,
    oldPrice: r.oldPrice,
    price: r.price,
    source: r.source,
    by: r.changedBy?.profile?.fullName ?? r.changedBy?.email ?? null,
  }));
}

// Delete a package (and its parameter links + sector prices, via cascade).
export async function deletePackage(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canManageParameters(actor.designation))
    throw new Error("Not permitted to delete packages.");

  const id = String(formData.get("packageId"));
  await prisma.package.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "DELETE",
    entityType: "Package",
    entityId: id,
  });
  revalidatePath("/app/parameters");
}

/**
 * Approve every parameter still pending, or every one in a single matrix.
 *
 * An uploaded master list arrives as hundreds of pending rows, and until they
 * are approved they cannot be quoted or booked on a sample — one Approve click
 * per row is not a workable gate. Each approval is still audited individually.
 */
export async function approveAllParameters(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveParameter(actor.designation))
    throw new Error("Only the COO can approve parameters.");

  const matrix = String(formData.get("matrix") ?? "").trim();
  const where = { approvedAt: null, ...(matrix ? { matrix } : {}) };

  const pending = await prisma.parameter.findMany({ where, select: { id: true } });
  if (pending.length === 0) return;

  const approvedAt = new Date();
  await prisma.$transaction([
    prisma.parameter.updateMany({ where, data: { approvedAt } }),
    prisma.auditLog.createMany({
      data: pending.map((p) => ({
        actorId: actor.id,
        action: "APPROVE" as const,
        entityType: "Parameter",
        entityId: p.id,
        after: { approved: true, bulk: true },
      })),
    }),
  ]);

  revalidatePath("/app/parameters");
}

// COO approves a proposed parameter (makes it selectable for samples).
export async function approveParameter(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canApproveParameter(actor.designation))
    throw new Error("Only the COO can approve parameters.");

  const id = String(formData.get("parameterId"));
  await prisma.parameter.update({
    where: { id },
    data: { approvedAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: "APPROVE",
    entityType: "Parameter",
    entityId: id,
    after: { approved: true },
  });

  revalidatePath("/app/parameters");
}
