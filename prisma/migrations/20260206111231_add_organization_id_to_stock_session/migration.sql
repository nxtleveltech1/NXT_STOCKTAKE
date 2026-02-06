-- AlterTable
ALTER TABLE "StockSession" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "StockSession_organizationId_idx" ON "StockSession"("organizationId");
