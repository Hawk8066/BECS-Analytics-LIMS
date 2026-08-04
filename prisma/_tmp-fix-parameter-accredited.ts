/**
 * One-off: correct the inverted `accredited` flag on imported parameters.
 *
 * In the source workbook (BECS Database.xlsx, "Test" sheet) the column headed
 * "NA" carries a "*" against 541 of 567 tests. That is the ISO 17025 convention
 * for "NA — not accredited", but the derived Parameters.xlsx mapped "*" to
 * accredited = true, so the flag went in backwards: 537 parameters claimed
 * accreditation and 24 did not.
 *
 * This flips every parameter's flag once. Guarded on the expected starting
 * distribution (a large majority true) so a second run can't undo the fix.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [accredited, notAccredited] = await Promise.all([
    prisma.parameter.count({ where: { accredited: true } }),
    prisma.parameter.count({ where: { accredited: false } }),
  ]);
  const total = accredited + notAccredited;
  console.log(`Before: ${accredited} accredited, ${notAccredited} not (of ${total}).`);

  if (total === 0) {
    console.log("No parameters — nothing to do.");
    return;
  }
  // The bug leaves the great majority flagged accredited. Once corrected the
  // ratio inverts, so this refuses to run a second time.
  if (accredited <= notAccredited) {
    console.log(
      "Aborting: most parameters are already not-accredited, so the flag looks corrected already.",
    );
    return;
  }

  // Resolve both id sets up front: updating by predicate would let the second
  // statement re-select the rows the first one just flipped.
  const wasTrue = (
    await prisma.parameter.findMany({ where: { accredited: true }, select: { id: true } })
  ).map((p) => p.id);
  const wasFalse = (
    await prisma.parameter.findMany({ where: { accredited: false }, select: { id: true } })
  ).map((p) => p.id);

  const flipped = await prisma.$transaction(async (tx) => {
    const a = await tx.parameter.updateMany({
      where: { id: { in: wasTrue } },
      data: { accredited: false },
    });
    const b = await tx.parameter.updateMany({
      where: { id: { in: wasFalse } },
      data: { accredited: true },
    });
    return { toNotAccredited: a.count, toAccredited: b.count };
  });

  const after = {
    accredited: await prisma.parameter.count({ where: { accredited: true } }),
    notAccredited: await prisma.parameter.count({ where: { accredited: false } }),
  };
  console.log("Flipped:", JSON.stringify(flipped));
  console.log("After:", JSON.stringify(after));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
