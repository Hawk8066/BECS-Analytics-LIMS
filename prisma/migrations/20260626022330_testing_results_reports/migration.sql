-- AlterTable
ALTER TABLE "SampleParameter" ADD COLUMN     "calculations" TEXT,
ADD COLUMN     "enteredAt" TIMESTAMP(3),
ADD COLUMN     "enteredById" TEXT,
ADD COLUMN     "outOfCalibration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rawDataAttachmentId" TEXT;

-- CreateTable
CREATE TABLE "FinalReport" (
    "id" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "qrText" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decodedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinalReport_reportNo_key" ON "FinalReport"("reportNo");

-- CreateIndex
CREATE UNIQUE INDEX "FinalReport_sampleId_key" ON "FinalReport"("sampleId");

-- AddForeignKey
ALTER TABLE "FinalReport" ADD CONSTRAINT "FinalReport_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
