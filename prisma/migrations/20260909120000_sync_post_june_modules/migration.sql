-- Captures schema changes made with `prisma db push` between 2026-06-26 and
-- 2026-09-09 that were never recorded as migrations. Without this, a fresh
-- deploy builds only the 50 tables the June migrations describe, while the
-- generated Prisma Client expects all 78 models -- so any page touching a
-- post-June module (BTF-QC, inspections, outsourcing, packages) fails at runtime.
--
-- Generated with: prisma migrate diff --from-url <db> --to-schema-datamodel

-- CreateEnum
CREATE TYPE "PricePriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "PriceChangeSource" AS ENUM ('MANUAL', 'IMPORT', 'BACKFILL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('OK', 'LOW', 'END');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('CHEMICAL', 'STANDARD_SOLUTION', 'GLASSWARE', 'EQUIPMENT', 'STORE_ITEM', 'MISCELLANEOUS', 'STATIONERY');

-- CreateEnum
CREATE TYPE "CheckAnswer" AS ENUM ('YES', 'NO', 'NA');

-- CreateEnum
CREATE TYPE "ExpiryCheck" AS ENUM ('OK', 'EXPIRED', 'NA');

-- CreateEnum
CREATE TYPE "InspectionSection" AS ENUM ('CHEMICAL', 'EQUIPMENT', 'MATERIAL');

-- CreateEnum
CREATE TYPE "ProductStage" AS ENUM ('RAW', 'INTERMEDIATE', 'FINISHED');

-- CreateEnum
CREATE TYPE "LotBasis" AS ENUM ('VEHICLE', 'BATCH');

-- CreateEnum
CREATE TYPE "QcLotStatus" AS ENUM ('BOOKED', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Designation" ADD VALUE 'ADMIN';
ALTER TYPE "Designation" ADD VALUE 'CLIENT';
ALTER TYPE "Designation" ADD VALUE 'VENDOR';
ALTER TYPE "Designation" ADD VALUE 'OUTSOURCE_LAB';

-- DropIndex
DROP INDEX "ImpartialityUndertaking_userId_key";

-- DropIndex
DROP INDEX "Parameter_name_key";

-- DropIndex
DROP INDEX "PurchaseOrder_prId_key";

-- AlterTable
ALTER TABLE "Authorization" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "addressLine3" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "ntn" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "stn" TEXT;

-- AlterTable
ALTER TABLE "CompetenceEvaluation" ADD COLUMN     "competent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "skills" TEXT,
ADD COLUMN     "training" TEXT,
ALTER COLUMN "result" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Function" ADD COLUMN     "minExperienceYears" DOUBLE PRECISION,
ADD COLUMN     "requiredEducation" TEXT[],
ADD COLUMN     "requiredFields" TEXT[],
ADD COLUMN     "requiredTrainings" TEXT[];

-- AlterTable
ALTER TABLE "ImpartialityUndertaking" ADD COLUMN     "year" INTEGER NOT NULL,
ALTER COLUMN "version" SET DEFAULT '2025';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "discountKind" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "discountValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quotationId" TEXT,
ADD COLUMN     "subtotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxPct" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PRLine" ADD COLUMN     "justification" TEXT,
ADD COLUMN     "packSize" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "selectionNote" TEXT,
ADD COLUMN     "specification" TEXT;

-- AlterTable
ALTER TABLE "Parameter" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lod" TEXT,
ADD COLUMN     "loq" TEXT,
ADD COLUMN     "matrix" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "tatDays" INTEGER,
ADD COLUMN     "tatUrgentDays" INTEGER,
ADD COLUMN     "urgentPrice" INTEGER;

-- AlterTable
ALTER TABLE "PersonnelProfile" ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT;

-- AlterTable
ALTER TABLE "Sample" ADD COLUMN     "physicalCondition" TEXT,
ADD COLUMN     "quantity" TEXT,
ADD COLUMN     "quotationId" TEXT,
ADD COLUMN     "standardId" TEXT,
ADD COLUMN     "thirdPartyId" TEXT;

-- AlterTable
ALTER TABLE "SampleParameter" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "conformity" TEXT,
ADD COLUMN     "limitMax" DOUBLE PRECISION,
ADD COLUMN     "limitMin" DOUBLE PRECISION,
ADD COLUMN     "outsourceBillId" TEXT,
ADD COLUMN     "outsourceLabId" TEXT,
ADD COLUMN     "pageNo" TEXT,
ADD COLUMN     "registerNo" TEXT,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "outsourceLabId" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "EducationEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "degreeLevel" TEXT NOT NULL,
    "subjects" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "designation" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "journal" TEXT,
    "year" INTEGER,
    "impactFactor" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsourceLab" (
    "id" TEXT NOT NULL,
    "labNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "facilityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutsourceLab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestQuotation" (
    "id" TEXT NOT NULL,
    "quoteNo" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sector" TEXT,
    "sampleType" TEXT,
    "sampleQty" INTEGER NOT NULL DEFAULT 1,
    "priority" "PricePriority" NOT NULL DEFAULT 'NORMAL',
    "taxPct" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountKind" TEXT NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestQuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestQuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matrix" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardLimit" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "StandardLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterSectorPrice" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "price" INTEGER,
    "urgentPrice" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterSectorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterPriceHistory" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sector" TEXT,
    "priority" "PricePriority" NOT NULL DEFAULT 'NORMAL',
    "oldPrice" INTEGER,
    "price" INTEGER,
    "source" "PriceChangeSource" NOT NULL DEFAULT 'MANUAL',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParameterPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matrix" TEXT,
    "price" INTEGER,
    "urgentPrice" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageParameter" (
    "packageId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,

    CONSTRAINT "PackageParameter_pkey" PRIMARY KEY ("packageId","parameterId")
);

-- CreateTable
CREATE TABLE "PackageSectorPrice" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "price" INTEGER,
    "urgentPrice" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageSectorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePriceHistory" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sector" TEXT,
    "priority" "PricePriority" NOT NULL DEFAULT 'NORMAL',
    "oldPrice" INTEGER,
    "price" INTEGER,
    "source" "PriceChangeSource" NOT NULL DEFAULT 'MANUAL',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdParty" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "ntn" TEXT,
    "stn" TEXT,
    "referenceClientId" TEXT,
    "facilityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThirdParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "prLineId" TEXT NOT NULL,
    "specification" TEXT,
    "rate" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "prLineId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "packSize" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT,
    "rate" INTEGER,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "pack" TEXT,
    "rack" TEXT,
    "make" TEXT,
    "model" TEXT,
    "parts" TEXT,
    "subCategory" TEXT,
    "quantity" INTEGER,
    "lotNo" TEXT,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'OK',
    "stockMarkedById" TEXT,
    "stockMarkedAt" TIMESTAMP(3),
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingInspection" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "decision" "ReceiptStatus" NOT NULL,
    "inspectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "poLineId" TEXT,
    "name" TEXT NOT NULL,
    "section" "InspectionSection" NOT NULL,
    "specs" "CheckAnswer",
    "quantity" "CheckAnswer",
    "packing" "CheckAnswer",
    "expiry" "ExpiryCheck",
    "storage" "CheckAnswer",

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsourceLabPrice" (
    "id" TEXT NOT NULL,
    "outsourceLabId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "price" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutsourceLabPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsourceBill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "outsourceLabId" TEXT NOT NULL,
    "labInvoiceNo" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxPct" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "journalEntryId" TEXT,
    "facilityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutsourceBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsourceBillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "sampleParameterId" TEXT,
    "name" TEXT NOT NULL,
    "sampleLabId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "OutsourceBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsourcePayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "paidById" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutsourcePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "ProductStage" NOT NULL,
    "basis" "LotBasis" NOT NULL,
    "testParameter" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '%',
    "specMin" DOUBLE PRECISION,
    "specMax" DOUBLE PRECISION,
    "parentTypeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcLot" (
    "id" TEXT NOT NULL,
    "lotNo" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "producedOn" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION,
    "quantityUnit" TEXT,
    "source" TEXT,
    "note" TEXT,
    "status" "QcLotStatus" NOT NULL DEFAULT 'BOOKED',
    "resultValue" DOUBLE PRECISION,
    "verdict" TEXT,
    "bookedById" TEXT,
    "assignedToId" TEXT,
    "testedById" TEXT,
    "testedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QcLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcLotLink" (
    "id" TEXT NOT NULL,
    "childLotId" TEXT NOT NULL,
    "parentLotId" TEXT NOT NULL,

    CONSTRAINT "QcLotLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EducationEntry_profileId_idx" ON "EducationEntry"("profileId");

-- CreateIndex
CREATE INDEX "ExperienceEntry_profileId_idx" ON "ExperienceEntry"("profileId");

-- CreateIndex
CREATE INDEX "TrainingEntry_profileId_idx" ON "TrainingEntry"("profileId");

-- CreateIndex
CREATE INDEX "PublicationEntry_profileId_idx" ON "PublicationEntry"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "OutsourceLab_labNo_key" ON "OutsourceLab"("labNo");

-- CreateIndex
CREATE INDEX "OutsourceLab_facilityId_idx" ON "OutsourceLab"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "TestQuotation_quoteNo_key" ON "TestQuotation"("quoteNo");

-- CreateIndex
CREATE INDEX "TestQuotation_clientId_idx" ON "TestQuotation"("clientId");

-- CreateIndex
CREATE INDEX "TestQuotationItem_quotationId_idx" ON "TestQuotationItem"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_name_key" ON "Standard"("name");

-- CreateIndex
CREATE INDEX "StandardLimit_parameterId_idx" ON "StandardLimit"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardLimit_standardId_parameterId_key" ON "StandardLimit"("standardId", "parameterId");

-- CreateIndex
CREATE INDEX "ParameterSectorPrice_parameterId_idx" ON "ParameterSectorPrice"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterSectorPrice_parameterId_sector_key" ON "ParameterSectorPrice"("parameterId", "sector");

-- CreateIndex
CREATE INDEX "ParameterPriceHistory_parameterId_sector_changedAt_idx" ON "ParameterPriceHistory"("parameterId", "sector", "changedAt");

-- CreateIndex
CREATE INDEX "ParameterPriceHistory_changedAt_idx" ON "ParameterPriceHistory"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- CreateIndex
CREATE INDEX "PackageParameter_parameterId_idx" ON "PackageParameter"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageSectorPrice_packageId_sector_key" ON "PackageSectorPrice"("packageId", "sector");

-- CreateIndex
CREATE INDEX "PackagePriceHistory_packageId_sector_changedAt_idx" ON "PackagePriceHistory"("packageId", "sector", "changedAt");

-- CreateIndex
CREATE INDEX "PackagePriceHistory_changedAt_idx" ON "PackagePriceHistory"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdParty_code_key" ON "ThirdParty"("code");

-- CreateIndex
CREATE INDEX "ThirdParty_facilityId_idx" ON "ThirdParty"("facilityId");

-- CreateIndex
CREATE INDEX "ThirdParty_referenceClientId_idx" ON "ThirdParty"("referenceClientId");

-- CreateIndex
CREATE INDEX "QuotationLine_prLineId_idx" ON "QuotationLine"("prLineId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationLine_quotationId_prLineId_key" ON "QuotationLine"("quotationId", "prLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_poId_idx" ON "PurchaseOrderLine"("poId");

-- CreateIndex
CREATE INDEX "InventoryItem_storeId_idx" ON "InventoryItem"("storeId");

-- CreateIndex
CREATE INDEX "InventoryItem_facilityId_idx" ON "InventoryItem"("facilityId");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingInspection_goodsReceiptId_key" ON "IncomingInspection"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "OutsourceLabPrice_outsourceLabId_idx" ON "OutsourceLabPrice"("outsourceLabId");

-- CreateIndex
CREATE UNIQUE INDEX "OutsourceLabPrice_outsourceLabId_parameterId_key" ON "OutsourceLabPrice"("outsourceLabId", "parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "OutsourceBill_billNo_key" ON "OutsourceBill"("billNo");

-- CreateIndex
CREATE INDEX "OutsourceBill_outsourceLabId_idx" ON "OutsourceBill"("outsourceLabId");

-- CreateIndex
CREATE INDEX "OutsourceBill_facilityId_idx" ON "OutsourceBill"("facilityId");

-- CreateIndex
CREATE INDEX "OutsourceBillItem_billId_idx" ON "OutsourceBillItem"("billId");

-- CreateIndex
CREATE INDEX "OutsourcePayment_billId_idx" ON "OutsourcePayment"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_facilityId_name_key" ON "ProductType"("facilityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "QcLot_lotNo_key" ON "QcLot"("lotNo");

-- CreateIndex
CREATE INDEX "QcLot_productTypeId_idx" ON "QcLot"("productTypeId");

-- CreateIndex
CREATE INDEX "QcLot_facilityId_idx" ON "QcLot"("facilityId");

-- CreateIndex
CREATE INDEX "QcLot_status_idx" ON "QcLot"("status");

-- CreateIndex
CREATE INDEX "QcLot_assignedToId_idx" ON "QcLot"("assignedToId");

-- CreateIndex
CREATE INDEX "QcLotLink_childLotId_idx" ON "QcLotLink"("childLotId");

-- CreateIndex
CREATE INDEX "QcLotLink_parentLotId_idx" ON "QcLotLink"("parentLotId");

-- CreateIndex
CREATE UNIQUE INDEX "QcLotLink_childLotId_parentLotId_key" ON "QcLotLink"("childLotId", "parentLotId");

-- CreateIndex
CREATE INDEX "ImpartialityUndertaking_userId_idx" ON "ImpartialityUndertaking"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpartialityUndertaking_userId_year_key" ON "ImpartialityUndertaking"("userId", "year");

-- CreateIndex
CREATE INDEX "Invoice_quotationId_idx" ON "Invoice"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "Parameter_name_matrix_key" ON "Parameter"("name", "matrix");

-- CreateIndex
CREATE INDEX "PurchaseOrder_prId_idx" ON "PurchaseOrder"("prId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_prId_vendorId_key" ON "Quotation"("prId", "vendorId");

-- CreateIndex
CREATE INDEX "Sample_quotationId_idx" ON "Sample"("quotationId");

-- CreateIndex
CREATE INDEX "Sample_standardId_idx" ON "Sample"("standardId");

-- CreateIndex
CREATE INDEX "Sample_thirdPartyId_idx" ON "Sample"("thirdPartyId");

-- CreateIndex
CREATE INDEX "SampleParameter_assignedToId_idx" ON "SampleParameter"("assignedToId");

-- CreateIndex
CREATE INDEX "SampleParameter_outsourceLabId_idx" ON "SampleParameter"("outsourceLabId");

-- CreateIndex
CREATE INDEX "SampleParameter_outsourceBillId_idx" ON "SampleParameter"("outsourceBillId");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE INDEX "User_vendorId_idx" ON "User"("vendorId");

-- CreateIndex
CREATE INDEX "User_outsourceLabId_idx" ON "User"("outsourceLabId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_outsourceLabId_fkey" FOREIGN KEY ("outsourceLabId") REFERENCES "OutsourceLab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationEntry" ADD CONSTRAINT "EducationEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PersonnelProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceEntry" ADD CONSTRAINT "ExperienceEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PersonnelProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEntry" ADD CONSTRAINT "TrainingEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PersonnelProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationEntry" ADD CONSTRAINT "PublicationEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PersonnelProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuotation" ADD CONSTRAINT "TestQuotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuotationItem" ADD CONSTRAINT "TestQuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "TestQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardLimit" ADD CONSTRAINT "StandardLimit_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardLimit" ADD CONSTRAINT "StandardLimit_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterSectorPrice" ADD CONSTRAINT "ParameterSectorPrice_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterPriceHistory" ADD CONSTRAINT "ParameterPriceHistory_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterPriceHistory" ADD CONSTRAINT "ParameterPriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageParameter" ADD CONSTRAINT "PackageParameter_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageParameter" ADD CONSTRAINT "PackageParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSectorPrice" ADD CONSTRAINT "PackageSectorPrice_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePriceHistory" ADD CONSTRAINT "PackagePriceHistory_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePriceHistory" ADD CONSTRAINT "PackagePriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "ThirdParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "TestQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdParty" ADD CONSTRAINT "ThirdParty_referenceClientId_fkey" FOREIGN KEY ("referenceClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleParameter" ADD CONSTRAINT "SampleParameter_outsourceLabId_fkey" FOREIGN KEY ("outsourceLabId") REFERENCES "OutsourceLab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleParameter" ADD CONSTRAINT "SampleParameter_outsourceBillId_fkey" FOREIGN KEY ("outsourceBillId") REFERENCES "OutsourceBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PRLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PRLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInspection" ADD CONSTRAINT "IncomingInspection_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "IncomingInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "TestQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsourceLabPrice" ADD CONSTRAINT "OutsourceLabPrice_outsourceLabId_fkey" FOREIGN KEY ("outsourceLabId") REFERENCES "OutsourceLab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsourceLabPrice" ADD CONSTRAINT "OutsourceLabPrice_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsourceBill" ADD CONSTRAINT "OutsourceBill_outsourceLabId_fkey" FOREIGN KEY ("outsourceLabId") REFERENCES "OutsourceLab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsourceBillItem" ADD CONSTRAINT "OutsourceBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "OutsourceBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsourcePayment" ADD CONSTRAINT "OutsourcePayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "OutsourceBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_parentTypeId_fkey" FOREIGN KEY ("parentTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcLot" ADD CONSTRAINT "QcLot_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcLot" ADD CONSTRAINT "QcLot_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcLotLink" ADD CONSTRAINT "QcLotLink_childLotId_fkey" FOREIGN KEY ("childLotId") REFERENCES "QcLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcLotLink" ADD CONSTRAINT "QcLotLink_parentLotId_fkey" FOREIGN KEY ("parentLotId") REFERENCES "QcLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

