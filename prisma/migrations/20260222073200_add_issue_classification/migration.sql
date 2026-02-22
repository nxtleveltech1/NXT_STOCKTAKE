-- AlterTable
ALTER TABLE "StockIssue" ADD COLUMN "classification" TEXT;

-- CreateIndex
CREATE INDEX "StockIssue_classification_idx" ON "StockIssue"("classification");
