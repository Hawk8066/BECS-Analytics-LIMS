/**
 * One-off: convert bulk-imported Parameter.price from rupees to paisa.
 *
 * The spreadsheet listed prices in PKR rupees (5000 = Rs 5,000) but the column
 * stores paisa, and the generic importer wrote the raw number through — leaving
 * every imported price 100x too small. The app's own price editor does this
 * same rupees -> paisa conversion on manual entry (see toPaisa in
 * lib/actions/parameters.ts); this backfills it for the imported rows.
 *
 * Guarded so a second run is a no-op rather than a 10,000x error.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Above this, values are already paisa — no lab test lists at Rs 2,000,000. */
const ALREADY_PAISA_THRESHOLD = 200_000;

async function main() {
  const agg = await prisma.parameter.aggregate({
    _max: { price: true },
    _min: { price: true },
    _count: { price: true },
  });
  console.log(
    `Before: ${agg._count.price} priced parameters, min=${agg._min.price}, max=${agg._max.price}`,
  );

  if (agg._count.price === 0) {
    console.log("Nothing to convert.");
    return;
  }
  if ((agg._max.price ?? 0) > ALREADY_PAISA_THRESHOLD) {
    console.log(
      `Aborting: max price ${agg._max.price} already looks like paisa. Conversion appears to have run already.`,
    );
    return;
  }

  const { count } = await prisma.parameter.updateMany({
    where: { price: { not: null } },
    data: { price: { multiply: 100 } },
  });

  const after = await prisma.parameter.aggregate({
    _max: { price: true },
    _min: { price: true },
  });
  console.log(
    `Converted ${count} row(s). After: min=${after._min.price}, max=${after._max.price} paisa ` +
      `(= PKR ${(after._min.price ?? 0) / 100} .. ${(after._max.price ?? 0) / 100})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
