-- Add organizationId to StockItem for NXT STOCK org scoping
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "StockItem_organizationId_idx" ON "StockItem"("organizationId");
