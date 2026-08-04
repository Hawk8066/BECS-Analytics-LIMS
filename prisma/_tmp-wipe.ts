/**
 * One-off wipe of previously imported reference data (Parameters + Clients)
 * and everything that references them. Mirrors the delete phase of
 * import-becs-db.ts, without the reload.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = {
    parameter: await prisma.parameter.count(),
    client: await prisma.client.count(),
  };
  console.log("Before:", JSON.stringify(before));

  await prisma.$transaction(
    async (tx) => {
      await tx.sampleParameter.deleteMany();
      await tx.finalReport.deleteMany();
      await tx.sample.deleteMany();
      await tx.testQuotationItem.deleteMany();
      await tx.testQuotation.deleteMany();
      await tx.payment.deleteMany();
      await tx.invoice.deleteMany();
      await tx.user.updateMany({
        where: { clientId: { not: null } },
        data: { clientId: null },
      });
      await tx.parameterSectorPrice.deleteMany();
      await tx.packageParameter.deleteMany();
      await tx.client.deleteMany();
      await tx.parameter.deleteMany();

      // reset the client numbering so a future import starts at CLI-00001
      await tx.sequence.upsert({
        where: { key: "CLIENT" },
        update: { counter: 0 },
        create: { key: "CLIENT", prefix: "CLI", counter: 0 },
      });
    },
    { timeout: 120000 },
  );

  const after = {
    parameter: await prisma.parameter.count(),
    client: await prisma.client.count(),
    sample: await prisma.sample.count(),
    invoice: await prisma.invoice.count(),
    quotation: await prisma.testQuotation.count(),
  };
  console.log("After:", JSON.stringify(after));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
