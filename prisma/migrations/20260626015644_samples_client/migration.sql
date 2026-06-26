-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('REGISTERED', 'ASSIGNED', 'RESULTS_ENTERED', 'VERIFIED', 'APPROVED', 'REPORTED');

-- CreateEnum
CREATE TYPE "MethodType" AS ENUM ('ADOPTED', 'LAB_DEVELOPED');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "clientNo" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "address" TEXT,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "sector" TEXT,
    "facilityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parameter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "accredited" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MethodType" NOT NULL DEFAULT 'ADOPTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "clientSampleRef" TEXT,
    "priority" TEXT,
    "instructions" TEXT,
    "thirdPartyName" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'REGISTERED',
    "facilityId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "registeredById" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleParameter" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "testMethodId" TEXT,
    "resultValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientNo_key" ON "Client"("clientNo");

-- CreateIndex
CREATE INDEX "Client_facilityId_idx" ON "Client"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Parameter_name_key" ON "Parameter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TestMethod_code_key" ON "TestMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_labId_key" ON "Sample"("labId");

-- CreateIndex
CREATE INDEX "Sample_clientId_idx" ON "Sample"("clientId");

-- CreateIndex
CREATE INDEX "Sample_facilityId_idx" ON "Sample"("facilityId");

-- CreateIndex
CREATE INDEX "Sample_sectionId_idx" ON "Sample"("sectionId");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "SampleParameter_sampleId_idx" ON "SampleParameter"("sampleId");

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleParameter" ADD CONSTRAINT "SampleParameter_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleParameter" ADD CONSTRAINT "SampleParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleParameter" ADD CONSTRAINT "SampleParameter_testMethodId_fkey" FOREIGN KEY ("testMethodId") REFERENCES "TestMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
