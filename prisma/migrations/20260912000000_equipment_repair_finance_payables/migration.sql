-- Schema for the equipment-repair / finance-payables work: equipment repair
-- workflow, per-lab registers, capability matrix, in-app feed, payroll tax,
-- stores rebuild, and the RYK monthly consolidated invoice.
--
-- These models were developed with `prisma db push`, so no migration existed.
-- Captured here with `prisma migrate diff` so a fresh deploy builds them:
-- 7 tables, 5 enums, 27 table alterations.
--
-- NOT PURELY ADDITIVE. This migration drops columns:
--   InventoryItem.stockMarkedAt, .stockMarkedById, .stockStatus  (+ type StockStatus)
--   Notification.title, .body, .link                             (superseded by lib/feed)
--
-- ORDERING MATTERS. The pre-merge code reads InventoryItem.stockStatus
-- (src/app/app/inventory/page.tsx, src/lib/actions/inventory.ts), so applying
-- this before the new code is deployed breaks the inventory pages. Deploy
-- first, then migrate. See DEPLOYMENT.md.
--
-- Verified against the Supabase project on 2026-09-12: InventoryItem and
-- Notification were both empty (0 rows), so no data was lost.

-- CreateEnum
CREATE TYPE "RepairKind" AS ENUM ('BREAKDOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RepairSite" AS ENUM ('ON_SITE', 'OFF_SITE');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('REQUESTED', 'GATE_PASSED', 'RECEIVED', 'INSPECTED', 'IN_SERVICE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('OUT', 'RETURNED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('UTILITY', 'RENT', 'TRANSPORT', 'MAINTENANCE', 'OFFICE', 'OTHER');

-- AlterEnum
ALTER TYPE "Designation" ADD VALUE 'ANALYST_RYK';

-- AlterEnum
ALTER TYPE "ItemCategory" ADD VALUE 'EQUIPMENT_REPAIR';

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- AlterTable
ALTER TABLE "CalibrationRecord" ADD COLUMN     "certificateNo" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "inventoryItemId" TEXT,
ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "qcBillingClientId" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "stockMarkedAt",
DROP COLUMN "stockMarkedById",
DROP COLUMN "stockStatus",
ADD COLUMN     "accessories" TEXT[],
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "reorderLevel" INTEGER,
ADD COLUMN     "specification" TEXT,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "body",
DROP COLUMN "link",
DROP COLUMN "title",
ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "params" JSONB NOT NULL,
ADD COLUMN     "template" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PayrollItem" ADD COLUMN     "cashAllowance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductType" ADD COLUMN     "parameterId" TEXT;

-- AlterTable
ALTER TABLE "QcLot" ADD COLUMN     "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "Qualification" ADD COLUMN     "repairId" TEXT;

-- AlterTable
ALTER TABLE "SalaryStructure" ADD COLUMN     "cashAllowance" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "StockStatus";

-- CreateTable
CREATE TABLE "CapabilityGrant" (
    "capability" TEXT NOT NULL,
    "designations" "Designation"[],
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityGrant_pkey" PRIMARY KEY ("capability")
);

-- CreateTable
CREATE TABLE "FeedEvent" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "audienceKey" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentRepair" (
    "id" TEXT NOT NULL,
    "repairNo" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "kind" "RepairKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "site" "RepairSite" NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'REQUESTED',
    "prId" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "reportedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedOn" TIMESTAMP(3),
    "inspectionResult" "ReceiptStatus",
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "inspectionNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "note" TEXT,
    "requestedById" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePass" (
    "id" TEXT NOT NULL,
    "gatePassNo" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "outDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "status" "GatePassStatus" NOT NULL DEFAULT 'OUT',
    "accessories" TEXT,
    "purpose" TEXT,
    "issuedById" TEXT,
    "receivedById" TEXT,
    "facilityId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poId" TEXT,
    "vendorInvoiceNo" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxPct" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "memo" TEXT,
    "journalEntryId" TEXT,
    "facilityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "paidById" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseNo" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "payee" TEXT,
    "memo" TEXT,
    "amount" INTEGER NOT NULL,
    "paidFrom" TEXT NOT NULL DEFAULT 'BANK',
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" TEXT,
    "facilityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedEvent_facilityId_sectionId_createdAt_idx" ON "FeedEvent"("facilityId", "sectionId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedEvent_createdAt_idx" ON "FeedEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentRepair_repairNo_key" ON "EquipmentRepair"("repairNo");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentRepair_prId_key" ON "EquipmentRepair"("prId");

-- CreateIndex
CREATE INDEX "EquipmentRepair_equipmentId_idx" ON "EquipmentRepair"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentRepair_status_idx" ON "EquipmentRepair"("status");

-- CreateIndex
CREATE INDEX "EquipmentRepair_facilityId_idx" ON "EquipmentRepair"("facilityId");

-- CreateIndex
CREATE INDEX "EquipmentRepair_sectionId_idx" ON "EquipmentRepair"("sectionId");

-- CreateIndex
CREATE INDEX "EquipmentRepair_vendorId_idx" ON "EquipmentRepair"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_gatePassNo_key" ON "GatePass"("gatePassNo");

-- CreateIndex
CREATE INDEX "GatePass_repairId_idx" ON "GatePass"("repairId");

-- CreateIndex
CREATE INDEX "GatePass_equipmentId_idx" ON "GatePass"("equipmentId");

-- CreateIndex
CREATE INDEX "GatePass_status_idx" ON "GatePass"("status");

-- CreateIndex
CREATE INDEX "GatePass_facilityId_idx" ON "GatePass"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_billNo_key" ON "VendorBill"("billNo");

-- CreateIndex
CREATE INDEX "VendorBill_vendorId_idx" ON "VendorBill"("vendorId");

-- CreateIndex
CREATE INDEX "VendorBill_poId_idx" ON "VendorBill"("poId");

-- CreateIndex
CREATE INDEX "VendorBill_facilityId_idx" ON "VendorBill"("facilityId");

-- CreateIndex
CREATE INDEX "VendorPayment_billId_idx" ON "VendorPayment"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseNo_key" ON "Expense"("expenseNo");

-- CreateIndex
CREATE INDEX "Expense_facilityId_idx" ON "Expense"("facilityId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "CalibrationRecord_vendorId_idx" ON "CalibrationRecord"("vendorId");

-- CreateIndex
CREATE INDEX "Equipment_storeId_idx" ON "Equipment"("storeId");

-- CreateIndex
CREATE INDEX "Equipment_inventoryItemId_idx" ON "Equipment"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Facility_qcBillingClientId_idx" ON "Facility"("qcBillingClientId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ProductType_parameterId_idx" ON "ProductType"("parameterId");

-- CreateIndex
CREATE INDEX "QcLot_invoiceId_idx" ON "QcLot"("invoiceId");

-- CreateIndex
CREATE INDEX "Qualification_repairId_idx" ON "Qualification"("repairId");

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_qcBillingClientId_fkey" FOREIGN KEY ("qcBillingClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedEvent" ADD CONSTRAINT "FeedEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRepair" ADD CONSTRAINT "EquipmentRepair_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRepair" ADD CONSTRAINT "EquipmentRepair_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRepair" ADD CONSTRAINT "EquipmentRepair_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "EquipmentRepair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "EquipmentRepair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcLot" ADD CONSTRAINT "QcLot_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

