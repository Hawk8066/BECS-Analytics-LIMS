-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('CHEMICAL', 'CRM', 'GLASSWARE', 'LAB_SUPPLY');

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "name" TEXT NOT NULL,
    "lotNo" TEXT,
    "certifiedValue" TEXT,
    "expiry" TIMESTAMP(3),
    "unit" TEXT,
    "facilityId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialItem_facilityId_idx" ON "MaterialItem"("facilityId");

-- CreateIndex
CREATE INDEX "MaterialItem_type_idx" ON "MaterialItem"("type");
