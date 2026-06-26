import { PrismaClient, type Designation, type SectionType } from "@prisma/client";
import { hash } from "argon2";

// Seeds facilities, sections, dev users, and a few functions (SSOT §4, §6).
// Run with: npx prisma db seed  (requires a running database).
const prisma = new PrismaClient();

const DEV_PASSWORD = "Passw0rd!";

async function main() {
  // --- Facilities ---
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

  // --- Sections ---
  const sections: Record<SectionType, { name: string; facilityId: string }> = {
    LAHORE_LAB: { name: "Lahore Lab", facilityId: lahore.id },
    MANAGEMENT: { name: "Management", facilityId: lahore.id },
    RYK_LAB: { name: "RYK Lab", facilityId: ryk.id },
  };
  const sectionIds: Partial<Record<SectionType, string>> = {};
  for (const [type, data] of Object.entries(sections) as [
    SectionType,
    { name: string; facilityId: string },
  ][]) {
    const s = await prisma.section.upsert({
      where: { type },
      update: {},
      create: { type, name: data.name, facilityId: data.facilityId },
    });
    sectionIds[type] = s.id;
  }

  // --- Dev users (all ACTIVE, shared dev password) ---
  const passwordHash = await hash(DEV_PASSWORD);
  const users: {
    email: string;
    designation: Designation;
    facilityId: string;
    sectionId: SectionType;
    fullName: string;
  }[] = [
    { email: "coo@becs.test", designation: "COO", facilityId: lahore.id, sectionId: "MANAGEMENT", fullName: "Chief Operating Officer" },
    { email: "om@becs.test", designation: "OPERATIONS_MANAGER", facilityId: lahore.id, sectionId: "MANAGEMENT", fullName: "Operations Manager" },
    { email: "labmanager.ryk@becs.test", designation: "LAB_MANAGER_RYK", facilityId: ryk.id, sectionId: "RYK_LAB", fullName: "Lab Manager (RYK)" },
    { email: "analyst@becs.test", designation: "ANALYST", facilityId: lahore.id, sectionId: "LAHORE_LAB", fullName: "Lahore Analyst" },
    { email: "liaison@becs.test", designation: "LIAISON_OFFICER", facilityId: lahore.id, sectionId: "MANAGEMENT", fullName: "Liaison Officer" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        status: "ACTIVE",
        designation: u.designation,
        facilityId: u.facilityId,
        sectionId: sectionIds[u.sectionId]!,
        profile: { create: { fullName: u.fullName } },
      },
    });
  }

  // --- A few approved functions (SSOT §6) ---
  const functions = [
    { code: "RUN_TM_014", name: "Run Test Method TM-014" },
    { code: "SIGN_FINAL_REPORT", name: "Sign Final Reports" },
    { code: "OPERATE_ICP", name: "Operate ICP-OES" },
    { code: "VERIFY_RESULTS", name: "Verify Analysis Results" },
  ];
  for (const f of functions) {
    await prisma.function.upsert({
      where: { code: f.code },
      update: {},
      create: { code: f.code, name: f.name, approvedAt: new Date() },
    });
  }

  console.log("Seeded facilities, sections, users, and functions.");
  console.log(`Dev login: coo@becs.test / ${DEV_PASSWORD} (and om@, analyst@, etc.)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
