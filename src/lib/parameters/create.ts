import "server-only";
import type { Designation, Prisma } from "@prisma/client";
import { canApproveParameter } from "@/lib/auth/perms";

/**
 * Creating a parameter, shared by every entry point.
 *
 * Deliberately NOT in `src/lib/actions/parameters.ts`: that is a `"use server"`
 * module, where every export is published as a callable server action. This is
 * an internal helper, not an endpoint.
 */

/** What a new parameter needs, already coerced. Prices are paisa; null = unset. */
export interface NewParameterInput {
  name: string;
  matrix: string | null;
  unit?: string | null;
  method?: string | null;
  lod?: string | null;
  loq?: string | null;
  accredited?: boolean;
  price: number | null;
  urgentPrice: number | null;
  tatDays?: number | null;
  tatUrgentDays?: number | null;
}

/**
 * Create a parameter and date its opening rates, inside a caller-supplied
 * transaction.
 *
 * Extracted so a second entry point — creating a QC product and its billable
 * parameter in one submit — cannot drift from the Parameters page. The
 * price-history rows are the reason: they make a rate auditable from the moment
 * it exists, and a create path that forgot them would leave the parameter
 * looking as though its price had always been whatever it is now.
 *
 * Approval is decided here from the actor's designation rather than by the
 * caller, so a new caller cannot bypass it: a COO or ADMIN gets a usable
 * parameter immediately, anyone else gets one pending COO approval.
 */
export async function createParameterRecord(
  tx: Prisma.TransactionClient,
  input: NewParameterInput,
  actor: { id: string; designation: Designation },
) {
  const approvedAt = canApproveParameter(actor.designation) ? new Date() : null;

  const created = await tx.parameter.create({
    data: {
      name: input.name,
      unit: input.unit || null,
      matrix: input.matrix,
      method: input.method || null,
      lod: input.lod || null,
      loq: input.loq || null,
      accredited: !!input.accredited,
      price: input.price,
      urgentPrice: input.urgentPrice,
      tatDays: input.tatDays ?? null,
      tatUrgentDays: input.tatUrgentDays ?? null,
      createdById: actor.id,
      approvedAt,
    },
  });

  // Log each rate that was set, so the price is dated from the start.
  const entries = (
    [
      ["NORMAL", input.price],
      ["URGENT", input.urgentPrice],
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

  return { created, approvedAt };
}
