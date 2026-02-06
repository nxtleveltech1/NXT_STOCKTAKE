-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "odooId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "location" TEXT NOT NULL,
    "warehouse" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "reservedQty" INTEGER,
    "availableQty" INTEGER,
    "countedQty" INTEGER,
    "variance" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastCountedBy" TEXT,
    "lastCountedAt" TIMESTAMP(3),
    "barcode" TEXT,
    "uom" TEXT,
    "serialNumber" TEXT,
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "countedItems" INTEGER NOT NULL DEFAULT 0,
    "varianceItems" INTEGER NOT NULL DEFAULT 0,
    "verifiedItems" INTEGER NOT NULL DEFAULT 0,
    "teamMembers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_odooId_key" ON "StockItem"("odooId");

-- CreateIndex
CREATE INDEX "StockItem_location_idx" ON "StockItem"("location");

-- CreateIndex
CREATE INDEX "StockItem_status_idx" ON "StockItem"("status");
