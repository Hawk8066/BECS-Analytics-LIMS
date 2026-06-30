import { PrismaClient, type Designation, type SectionType } from "@prisma/client";
import { hash } from "argon2";
import { createHash } from "crypto";

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
    { email: "purchaser@becs.test", designation: "PURCHASE_OFFICER", facilityId: lahore.id, sectionId: "MANAGEMENT", fullName: "Purchase Officer" },
    { email: "accountant@becs.test", designation: "ACCOUNTANT", facilityId: lahore.id, sectionId: "MANAGEMENT", fullName: "Accountant" },
    { email: "store@becs.test", designation: "STORE_INCHARGE", facilityId: lahore.id, sectionId: "MANAGEMENT", fullName: "Store In-charge" },
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

  // --- Application super-admin (full view/edit/delete; all actions audited) ---
  const adminPasswordHash = await hash(
    process.env.ADMIN_PASSWORD ?? "Admin@12345",
  );
  await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? "admin@becs.test" },
    update: { designation: "ADMIN", status: "ACTIVE" },
    create: {
      email: process.env.ADMIN_EMAIL ?? "admin@becs.test",
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
      designation: "ADMIN",
      facilityId: lahore.id,
      sectionId: sectionIds.MANAGEMENT!,
      profile: { create: { fullName: "Application Administrator" } },
    },
  });

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

  // --- Parameters (master; RYK ones are accredited) ---
  const parameters = [
    { name: "BAZ", unit: "%", accredited: true, price: 500000 },
    { name: "Total Zinc", unit: "%", accredited: true, price: 600000 },
    { name: "Citrate-Soluble P2O5", unit: "%", accredited: true, price: 700000 },
    { name: "Nitrogen", unit: "%", accredited: true, price: 450000 },
    { name: "pH", unit: "", accredited: false, price: 200000 },
    { name: "Moisture", unit: "%", accredited: false, price: 250000 },
  ];
  for (const p of parameters) {
    await prisma.parameter.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }

  // --- Test methods (master) ---
  const methods = [
    { code: "TM-014", name: "Test Method TM-014", type: "ADOPTED" as const },
    { code: "AOAC-965.09", name: "AOAC 965.09", type: "ADOPTED" as const },
    { code: "INHOUSE-ZN", name: "In-house Zinc Method", type: "LAB_DEVELOPED" as const },
  ];
  for (const m of methods) {
    await prisma.testMethod.upsert({
      where: { code: m.code },
      update: {},
      create: m,
    });
  }

  // --- Clients ---
  await prisma.client.upsert({
    where: { clientNo: "CLI-00001" },
    update: {},
    create: {
      clientNo: "CLI-00001",
      company: "Bio Tech Fertilizers (Pvt) Ltd",
      sector: "Fertilizer",
      facilityId: ryk.id,
    },
  });
  await prisma.client.upsert({
    where: { clientNo: "CLI-00002" },
    update: {},
    create: {
      clientNo: "CLI-00002",
      company: "AgriCorp (Pvt) Ltd",
      sector: "Agriculture",
      facilityId: lahore.id,
    },
  });

  // --- Demo samples (for workflow + report rendering) ---
  const agri = await prisma.client.findUnique({ where: { clientNo: "CLI-00002" } });
  const pH = await prisma.parameter.findUnique({ where: { name: "pH" } });
  const moisture = await prisma.parameter.findUnique({ where: { name: "Moisture" } });
  const lahoreLab = sectionIds.LAHORE_LAB!;
  if (agri && pH && moisture) {
    // S1 — newly registered (awaiting assignment)
    if (!(await prisma.sample.findUnique({ where: { labId: "LHR-S-2026-900001" } }))) {
      await prisma.sample.create({
        data: {
          labId: "LHR-S-2026-900001",
          clientId: agri.id,
          sampleType: "Compost",
          facilityId: lahore.id,
          sectionId: lahoreLab,
          status: "REGISTERED",
          parameters: {
            create: [{ parameterId: pH.id }, { parameterId: moisture.id }],
          },
        },
      });
    }
    // S2 — fully processed with a final report
    if (!(await prisma.sample.findUnique({ where: { labId: "LHR-S-2026-900002" } }))) {
      const s2 = await prisma.sample.create({
        data: {
          labId: "LHR-S-2026-900002",
          clientId: agri.id,
          sampleType: "Soil",
          facilityId: lahore.id,
          sectionId: lahoreLab,
          status: "REPORTED",
          parameters: {
            create: [
              { parameterId: pH.id, resultValue: "6.8" },
              { parameterId: moisture.id, resultValue: "12.3" },
            ],
          },
        },
        include: { parameters: { include: { parameter: true } } },
      });
      const snapshot = JSON.stringify({
        labId: s2.labId,
        parameters: s2.parameters.map((p) => ({
          name: p.parameter.name,
          result: p.resultValue,
        })),
      });
      const contentHash = createHash("sha256").update(snapshot).digest("hex");
      await prisma.finalReport.create({
        data: {
          reportNo: "LHR-R-2026-900002",
          sampleId: s2.id,
          contentHash,
          qrText: `LHR-R-2026-900002|${contentHash.slice(0, 16)}`,
          decodedAt: new Date(),
        },
      });
    }
  }

  // --- Demo vendor + purchase request ---
  if (!(await prisma.vendor.findUnique({ where: { vendorNo: "VEN-90001" } }))) {
    await prisma.vendor.create({
      data: {
        vendorNo: "VEN-90001",
        company: "ChemSupply Co",
        fields: ["Chemicals", "Lab Supplies"],
        ntn: "1234567-8",
      },
    });
  }
  const analystUser = await prisma.user.findUnique({
    where: { email: "analyst@becs.test" },
  });
  if (
    analystUser &&
    !(await prisma.purchaseRequest.findUnique({
      where: { prNo: "PR-LHR-2026-90001" },
    }))
  ) {
    await prisma.purchaseRequest.create({
      data: {
        prNo: "PR-LHR-2026-90001",
        requestedById: analystUser.id,
        facilityId: lahore.id,
        sectionId: lahoreLab,
        note: "Monthly lab consumables",
        lines: {
          create: [
            { description: "Sulfuric acid 2.5L", category: "CHEMICAL", path: "FULL", quantity: 4, unit: "btl" },
            { description: "A4 paper", category: "STATIONERY", path: "SIMPLIFIED", quantity: 10, unit: "ream" },
          ],
        },
      },
    });
  }

  // --- Stores (one main + sub-stores) ---
  const storeDefs: { name: string; type: "MAIN" | "SUB"; facilityId: string }[] = [
    { name: "Lahore Main Store", type: "MAIN", facilityId: lahore.id },
    { name: "Lahore Lab Store", type: "SUB", facilityId: lahore.id },
    { name: "RYK Lab Store", type: "SUB", facilityId: ryk.id },
    { name: "Lahore Management Store", type: "SUB", facilityId: lahore.id },
  ];
  for (const s of storeDefs) {
    if (!(await prisma.store.findFirst({ where: { name: s.name } }))) {
      await prisma.store.create({ data: s });
    }
  }

  // --- Demo equipment (one in-calibration, one expired) ---
  if (!(await prisma.equipment.findUnique({ where: { assetTag: "EQ-LHR-9001" } }))) {
    const e1 = await prisma.equipment.create({
      data: {
        assetTag: "EQ-LHR-9001",
        name: "Analytical Balance",
        make: "Sartorius",
        facilityId: lahore.id,
        sectionId: lahoreLab,
      },
    });
    await prisma.calibrationRecord.create({
      data: {
        equipmentId: e1.id,
        calibratedOn: new Date("2026-01-15"),
        validUntil: new Date("2027-01-15"),
        calibratedBy: "NPSL",
      },
    });
  }
  if (!(await prisma.equipment.findUnique({ where: { assetTag: "EQ-LHR-9002" } }))) {
    const e2 = await prisma.equipment.create({
      data: {
        assetTag: "EQ-LHR-9002",
        name: "pH Meter",
        make: "Hanna",
        facilityId: lahore.id,
        sectionId: lahoreLab,
      },
    });
    await prisma.calibrationRecord.create({
      data: {
        equipmentId: e2.id,
        calibratedOn: new Date("2025-01-10"),
        validUntil: new Date("2025-12-31"),
        calibratedBy: "internal",
      },
    });
  }

  // --- Demo materials (chemical w/o CoA, CRM, glassware) ---
  const matDefs: {
    type: "CHEMICAL" | "CRM" | "GLASSWARE" | "LAB_SUPPLY";
    name: string;
    lotNo?: string;
    certifiedValue?: string;
    unit?: string;
  }[] = [
    { type: "CHEMICAL", name: "Sulfuric Acid 98%", lotNo: "SA-2026-01", unit: "L" },
    { type: "CRM", name: "Zinc Reference Standard", certifiedValue: "99.99% ± 0.01", lotNo: "ZN-CRM-07", unit: "g" },
    { type: "GLASSWARE", name: "Volumetric Flask 100mL", lotNo: "VF-100-12", unit: "pc" },
  ];
  for (const m of matDefs) {
    if (!(await prisma.materialItem.findFirst({ where: { name: m.name, type: m.type } }))) {
      await prisma.materialItem.create({
        data: {
          type: m.type,
          name: m.name,
          lotNo: m.lotNo ?? null,
          certifiedValue: m.certifiedValue ?? null,
          unit: m.unit ?? null,
          facilityId: lahore.id,
          sectionId: lahoreLab,
        },
      });
    }
  }

  // --- Chart of accounts (double-entry GL, ADR-0004) ---
  const accounts: { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" }[] = [
    { code: "1000", name: "Cash", type: "ASSET" },
    { code: "1010", name: "Bank", type: "ASSET" },
    { code: "1100", name: "Accounts Receivable", type: "ASSET" },
    { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
    { code: "3000", name: "Owner's Equity", type: "EQUITY" },
    { code: "4000", name: "Sales Revenue", type: "REVENUE" },
    { code: "5000", name: "Operating Expenses", type: "EXPENSE" },
    { code: "5100", name: "Payroll Expense", type: "EXPENSE" },
  ];
  for (const a of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: a.code },
      update: {},
      create: a,
    });
  }

  // --- Demo invoice with its balanced journal entry (Dr AR / Cr Revenue) ---
  const agriClient = await prisma.client.findUnique({ where: { clientNo: "CLI-00002" } });
  const arAcct = await prisma.chartOfAccount.findUnique({ where: { code: "1100" } });
  const revAcct = await prisma.chartOfAccount.findUnique({ where: { code: "4000" } });
  if (
    agriClient &&
    arAcct &&
    revAcct &&
    !(await prisma.invoice.findUnique({ where: { invoiceNo: "INV-LHR-2026-90001" } }))
  ) {
    const amount = 5000000; // PKR 50,000.00 in paisa
    const entry = await prisma.journalEntry.create({
      data: {
        entryNo: "JE-2026-900001",
        memo: "Invoice INV-LHR-2026-90001",
        lines: {
          create: [
            { accountId: arAcct.id, debit: amount },
            { accountId: revAcct.id, credit: amount },
          ],
        },
      },
    });
    await prisma.invoice.create({
      data: {
        invoiceNo: "INV-LHR-2026-90001",
        clientId: agriClient.id,
        amount,
        journalEntryId: entry.id,
        facilityId: lahore.id,
      },
    });
  }

  // --- Salary structures (paisa) for a few employees ---
  const salaryDefs = [
    { email: "om@becs.test", basic: 15000000, houseRent: 6000000, conveyance: 2000000, medical: 1000000, providentFundPct: 5, eobi: 25000 },
    { email: "analyst@becs.test", basic: 8000000, houseRent: 3200000, conveyance: 1000000, medical: 500000, providentFundPct: 5, eobi: 25000 },
    { email: "accountant@becs.test", basic: 9000000, houseRent: 3600000, conveyance: 1000000, medical: 500000, providentFundPct: 5, eobi: 25000 },
  ];
  for (const sd of salaryDefs) {
    const u = await prisma.user.findUnique({ where: { email: sd.email } });
    if (u && !(await prisma.salaryStructure.findUnique({ where: { userId: u.id } }))) {
      await prisma.salaryStructure.create({
        data: {
          userId: u.id,
          basic: sd.basic,
          houseRent: sd.houseRent,
          conveyance: sd.conveyance,
          medical: sd.medical,
          providentFundPct: sd.providentFundPct,
          eobi: sd.eobi,
        },
      });
    }
  }

  // Initialise the CLIENT number sequence past the seeded clients so generated
  // client numbers (CLI-00003+) don't collide with CLI-00001/00002.
  await prisma.sequence.upsert({
    where: { key: "CLIENT" },
    update: {},
    create: { key: "CLIENT", prefix: "CLI", counter: 2 },
  });

  console.log("Seeded facilities, sections, users, functions, parameters, methods, clients.");
  console.log(`Dev login: coo@becs.test / ${DEV_PASSWORD} (and om@, analyst@, etc.)`);
  console.log(
    `Admin login: ${process.env.ADMIN_EMAIL ?? "admin@becs.test"} / ${process.env.ADMIN_PASSWORD ?? "Admin@12345"} (designation ADMIN)`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
