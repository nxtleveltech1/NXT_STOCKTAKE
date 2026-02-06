-- CreateTable
CREATE TABLE "StockActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "zone" TEXT,
    "itemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockActivity_organizationId_idx" ON "StockActivity"("organizationId");

-- CreateIndex
CREATE INDEX "StockActivity_sessionId_idx" ON "StockActivity"("sessionId");

-- CreateIndex
CREATE INDEX "StockActivity_createdAt_idx" ON "StockActivity"("createdAt" DESC);
