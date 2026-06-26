import { PrismaClient } from "@prisma/client";

// Seeds the two facilities and three sections (SSOT §4). Run with:
//   npx prisma db seed   (configured in package.json -> prisma.seed)
// Requires a running database (see docker-compose.yml + .env).
const prisma = new PrismaClient();

async function main() {
  const lahore = await prisma.facility.upsert({
    where: { code: "LAHORE" },
    update: {},
    create: { code: "LAHORE", name: "BECS Analytics Lahore (Parent Lab)" },
  });

  const ryk = await prisma.facility.upsert({
    where: { code: "RYK" },
    update: {},
    create: { code: "RYK", name: "BECS Analytics Rahimyar Khan (Sub Lab)" },
  });

  await prisma.section.upsert({
    where: { type: "LAHORE_LAB" },
    update: {},
    create: { type: "LAHORE_LAB", name: "Lahore Lab", facilityId: lahore.id },
  });

  await prisma.section.upsert({
    where: { type: "MANAGEMENT" },
    update: {},
    create: { type: "MANAGEMENT", name: "Management", facilityId: lahore.id },
  });

  await prisma.section.upsert({
    where: { type: "RYK_LAB" },
    update: {},
    create: { type: "RYK_LAB", name: "RYK Lab", facilityId: ryk.id },
  });

  console.log("Seeded facilities and sections.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
