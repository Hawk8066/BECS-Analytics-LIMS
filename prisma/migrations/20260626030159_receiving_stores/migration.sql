-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('MAIN', 'SUB');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING_INSPECTION', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StoreType" NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING_INSPECTION',
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRN" (
    "id" TEXT NOT NULL,
    "grnNo" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoodsReceipt_poId_idx" ON "GoodsReceipt"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_grnNo_key" ON "GRN"("grnNo");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_goodsReceiptId_key" ON "GRN"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "StockTransaction_storeId_idx" ON "StockTransaction"("storeId");

-- CreateIndex
CREATE INDEX "IssueRequest_status_idx" ON "IssueRequest"("status");

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
