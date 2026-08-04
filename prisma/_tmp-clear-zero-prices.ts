/**
 * One-off: turn PKR 0 prices into "no price".
 *
 * The uploaded workbook left some tests at 0, which the app reads as a real
 * price — the quotation and sample forms will happily quote them free. An
 * unpriced test should read "—" instead, so the base price is cleared and the
 * sector prices that were fanned out from it are removed.
 *
 * Every removal is written to the price trail as a CORRECTION (no operator on
 * record), so the change stays traceable to the day it was made.
 *
 * Re-runnable: a second run finds nothing at 0 and does nothing.
 *   npx tsx prisma/_tmp-clear-zero-prices.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const zeroPriced = await prisma.parameter.findMany({
    where: { price: 0 },
    select: { id: true, name: true },
  });

  if (zeroPriced.length === 0) {
    console.log("No parameters priced at 0 — nothing to do.");
    return;
  }

  const ids = zeroPriced.map((p) => p.id);
  const sectorPrices = await prisma.parameterSectorPrice.findMany({
    where: { parameterId: { in: ids }, price: 0 },
    select: { parameterId: true, sector: true },
  });

  console.log(
    `${zeroPriced.length} parameter(s) at PKR 0, with ${sectorPrices.length} sector price(s) to clear.`,
  );

  await prisma.$transaction(async (tx) => {
    // Log first: the trail records what the price *was*.
    if (sectorPrices.length > 0) {
      await tx.parameterPriceHistory.createMany({
        data: sectorPrices.map((sp) => ({
          parameterId: sp.parameterId,
          sector: sp.sector,
          oldPrice: 0,
          price: null,
          source: "CORRECTION" as const,
          changedById: null,
        })),
      });
      await tx.parameterSectorPrice.deleteMany({
        where: { parameterId: { in: ids }, price: 0 },
      });
    }
    // Clear the base price too, or it would keep showing as 0 via the fallback.
    await tx.parameter.updateMany({ where: { id: { in: ids } }, data: { price: null } });
  });

  console.log(
    `Cleared ${sectorPrices.length} sector price(s) and unset ${zeroPriced.length} base price(s); ` +
      "each removal is logged in the price trail.",
  );
  console.log(`Examples: ${zeroPriced.slice(0, 5).map((p) => p.name).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
