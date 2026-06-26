-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('CHEMICAL', 'EQUIPMENT', 'EQUIPMENT_SUPPLY', 'GLASSWARE', 'LAB_SUPPLY', 'STATIONERY', 'SANITARY', 'FURNITURE', 'PPE', 'UTILITY');

-- CreateEnum
CREATE TYPE "ProcurementPath" AS ENUM ('FULL', 'SIMPLIFIED');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "vendorNo" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "address" TEXT,
    "contactNumber" TEXT,
    "ntn" TEXT,
    "stn" TEXT,
    "employees" INTEGER,
    "fields" TEXT[],
    "accountNumber" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "prNo" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "PRStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "facilityId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRLine" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "path" "ProcurementPath" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,

    CONSTRAINT "PRLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorNo_key" ON "Vendor"("vendorNo");

-- CreateIndex
CREATE INDEX "Vendor_company_idx" ON "Vendor"("company");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_prNo_key" ON "PurchaseRequest"("prNo");

-- CreateIndex
CREATE INDEX "PurchaseRequest_facilityId_idx" ON "PurchaseRequest"("facilityId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_sectionId_idx" ON "PurchaseRequest"("sectionId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PRLine_prId_idx" ON "PRLine"("prId");

-- AddForeignKey
ALTER TABLE "PRLine" ADD CONSTRAINT "PRLine_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
