/**
 * One-off: save the prices already uploaded as real per-sector prices, and give
 * every price entered so far a dated entry in the price trail.
 *
 * A bulk-imported parameter only carries the flat `Parameter.price`, which the
 * Prices tab merely *displays* as a fallback (lib/pricing.ts) — nothing is
 * stored in ParameterSectorPrice until someone edits that cell. New uploads now
 * fan the price out across sectors themselves (lib/xlsx/after-import.ts); this
 * does the same for the rows imported before that existed.
 *
 * Prices set before the trail existed are logged as BACKFILL, dated from the
 * sector price's own updatedAt — the best date the database actually knows.
 *
 * Re-runnable: existing sector prices are deliberate overrides and are kept,
 * and a sector that already has a trail is left alone.
 *   npx tsx prisma/_tmp-materialize-sector-prices.ts
 */
import { PrismaClient } from "@prisma/client";
import { SECTORS } from "../src/lib/sectors";

const prisma = new PrismaClient();

/** Below this the column still looks like rupees, not paisa. */
const LOOKS_LIKE_RUPEES_BELOW = 200_000;

async function main() {
  const priced = await prisma.parameter.findMany({
    where: { price: { not: null } },
    select: { id: true, price: true },
  });

  if (priced.length === 0) {
    console.log("No priced parameters — nothing to do.");
    return;
  }

  const max = Math.max(...priced.map((p) => p.price!));
  if (max < LOOKS_LIKE_RUPEES_BELOW) {
    console.log(
      `Aborting: highest price is ${max}, which still looks like rupees. ` +
        "Run prisma/_tmp-fix-parameter-price.ts first.",
    );
    return;
  }

  const rows = priced.flatMap((p) =>
    SECTORS.map((sector) => ({ parameterId: p.id, sector, price: p.price! })),
  );
  const { count } = await prisma.parameterSectorPrice.createMany({
    data: rows,
    skipDuplicates: true,
  });

  console.log(
    `${priced.length} priced parameter(s) x ${SECTORS.length} sectors = ${rows.length} row(s): ` +
      `created ${count}, left ${rows.length - count} existing sector price(s) untouched.`,
  );

  await backfillHistory();
}

/**
 * Give every saved sector price a dated trail entry, if it has none.
 *
 * The date has to be the day the price took effect, not the day this script
 * runs. A sector price still equal to the parameter's uploaded base price has
 * never been touched, so it dates from when the parameter was uploaded; one
 * that differs was edited by hand, and its own updatedAt is that date.
 */
async function backfillHistory() {
  const [current, params, logged] = await Promise.all([
    prisma.parameterSectorPrice.findMany({
      select: { parameterId: true, sector: true, price: true, updatedAt: true },
    }),
    prisma.parameter.findMany({ select: { id: true, price: true, createdAt: true } }),
    prisma.parameterPriceHistory.findMany({
      select: { parameterId: true, sector: true },
      distinct: ["parameterId", "sector"],
    }),
  ]);

  const parameter = new Map(params.map((p) => [p.id, p]));
  const seen = new Set(logged.map((l) => `${l.parameterId}:${l.sector}`));
  const missing = current.filter((c) => !seen.has(`${c.parameterId}:${c.sector}`));
  if (missing.length === 0) {
    console.log("Price trail: every sector price already has one — nothing added.");
    return;
  }

  let fromUpload = 0;
  const data = missing.map((m) => {
    const p = parameter.get(m.parameterId);
    const untouched = p != null && p.price === m.price;
    if (untouched) fromUpload++;
    return {
      parameterId: m.parameterId,
      sector: m.sector,
      oldPrice: null,
      price: m.price,
      source: "BACKFILL" as const,
      changedById: null, // pre-dates the trail; no actor is on record
      changedAt: untouched ? p!.createdAt : m.updatedAt,
    };
  });

  const { count } = await prisma.parameterPriceHistory.createMany({ data });
  console.log(
    `Price trail: logged ${count} existing price(s) — ${fromUpload} dated from the ` +
      `parameter's upload, ${count - fromUpload} from their last edit.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
