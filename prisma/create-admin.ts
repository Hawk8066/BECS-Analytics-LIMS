import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

// Creates (or updates) the application super-admin account.
// Run with:  tsx prisma/create-admin.ts
// Override defaults with env vars ADMIN_EMAIL / ADMIN_PASSWORD.
const prisma = new PrismaClient();

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@becs.test";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@12345";

async function main() {
  // Anchor the admin to the Lahore / Management section (falls back to first available).
  const facility =
    (await prisma.facility.findUnique({ where: { code: "LAHORE" } })) ??
    (await prisma.facility.findFirst());
  const section =
    (await prisma.section.findUnique({ where: { type: "MANAGEMENT" } })) ??
    (await prisma.section.findFirst());

  if (!facility || !section) {
    throw new Error(
      "No facility/section found. Run `npm run db:seed` first to create base data.",
    );
  }

  const passwordHash = await hash(PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      status: "ACTIVE",
      designation: "ADMIN",
    },
    create: {
      email: EMAIL,
      passwordHash,
      status: "ACTIVE",
      designation: "ADMIN",
      facilityId: facility.id,
      sectionId: section.id,
      profile: { create: { fullName: "Application Administrator" } },
    },
  });

  console.log(`✔ Admin ready: ${user.email} / ${PASSWORD}  (designation=ADMIN, status=ACTIVE)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
