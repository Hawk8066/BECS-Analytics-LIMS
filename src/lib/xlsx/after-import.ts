import "server-only";

/**
 * Per-model follow-up work, run inside the import transaction.
 *
 * The importer itself stays generic (columns -> Prisma fields, one create per
 * row). A few models need something extra saved alongside those rows; that
 * lives here rather than as `if (model.name === ...)` inside the action.
 *
 * A hook returns a one-line note for the result panel, or null if it did
 * nothing. Throwing rolls the whole import back, same as any other failure.
 */
import type { Prisma } from "@prisma/client";
import type { AdminModel } from "@/lib/admin/registry";

type Tx = Prisma.TransactionClient;
type Created = Array<Record<string, unknown>>;

export async function afterImport(
  tx: Tx,
  model: AdminModel,
  created: Created,
  actorId: string,
): Promise<string | null> {
  if (model.name === "Parameter") return logImportedPrices(tx, created, actorId);
  return null;
}

/**
 * An uploaded parameter carries its price on the row itself (Parameter.price /
 * urgentPrice) — pricing is per parameter, not per sector, so the price is
 * already saved by the generic import. Here we just add a dated trail entry per
 * grade, so an uploaded price is traceable to the day it landed and to whoever
 * uploaded the file (all new parameters, so no prior price).
 */
async function logImportedPrices(
  tx: Tx,
  created: Created,
  actorId: string,
): Promise<string | null> {
  const priced = created.filter(
    (row) =>
      typeof row.id === "string" &&
      (typeof row.price === "number" || typeof row.urgentPrice === "number"),
  );
  if (priced.length === 0) return null;

  await tx.parameterPriceHistory.createMany({
    data: priced.flatMap((row) =>
      (
        [
          ["NORMAL", row.price],
          ["URGENT", row.urgentPrice],
        ] as const
      )
        .filter(([, value]) => typeof value === "number")
        .map(([priority, value]) => ({
          parameterId: row.id as string,
          priority,
          oldPrice: null,
          price: value as number,
          source: "IMPORT" as const,
          changedById: actorId,
        })),
    ),
  });

  return `Priced ${priced.length} parameter(s) from the upload, logged against today's date and adjustable on the Prices tab.`;
}
