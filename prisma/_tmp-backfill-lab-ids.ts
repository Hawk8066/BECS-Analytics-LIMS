// One-off: renumber every existing sample's Lab ID into the LHR-YYMM-XXXX format
// (matching src/lib/actions/samples.ts). Serial runs continuously through each
// year per facility (it does NOT reset monthly); YYMM is the sample's
// registration month. Two-pass to avoid transient @unique collisions.
//
// Run: npx tsx prisma/_tmp-backfill-lab-ids.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LAB_PREFIX: Record<string, string> = { LAHORE: "LHR", RYK: "RYK" };

async function main() {
  const facilities = await prisma.facility.findMany({
    select: { id: true, code: true },
  });

  for (const f of facilities) {
    const prefix = LAB_PREFIX[f.code] ?? f.code;
    const samples = await prisma.sample.findMany({
      where: { facilityId: f.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, labId: true, createdAt: true },
    });
    if (samples.length === 0) continue;

    // Assign the target id per sample: yearly-reset serial, YYMM per sample.
    const serialByYear: Record<number, number> = {};
    const maxSerialByYear: Record<number, number> = {};
    const target = new Map<string, string>();
    for (const s of samples) {
      const y = s.createdAt.getFullYear();
      const serial = (serialByYear[y] = (serialByYear[y] ?? 0) + 1);
      maxSerialByYear[y] = serial;
      const yy = String(y % 100).padStart(2, "0");
      const mm = String(s.createdAt.getMonth() + 1).padStart(2, "0");
      target.set(s.id, `${prefix}-${yy}${mm}-${String(serial).padStart(4, "0")}`);
    }

    await prisma.$transaction(async (tx) => {
      // Pass 1: park every sample on a guaranteed-unique temporary id.
      for (const s of samples) {
        await tx.sample.update({
          where: { id: s.id },
          data: { labId: `MIGRATING-${s.id}` },
        });
      }
      // Pass 2: set the final ids.
      for (const s of samples) {
        await tx.sample.update({
          where: { id: s.id },
          data: { labId: target.get(s.id)! },
        });
      }
      // Continue the live sequence from the highest serial used per year, so
      // newly registered samples don't reuse a number.
      for (const [yStr, maxSerial] of Object.entries(maxSerialByYear)) {
        const key = `SAMPLE:${f.code}:${yStr}`;
        await tx.sequence.upsert({
          where: { key },
          update: { counter: maxSerial },
          create: { key, prefix: key, counter: maxSerial },
        });
      }
    });

    console.log(
      `${f.code}: renumbered ${samples.length} sample(s) — e.g. ${
        target.get(samples[0].id) ?? "?"
      } … ${target.get(samples[samples.length - 1].id) ?? "?"}`,
    );
  }
}

main()
  .then(() => console.log("Done."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
