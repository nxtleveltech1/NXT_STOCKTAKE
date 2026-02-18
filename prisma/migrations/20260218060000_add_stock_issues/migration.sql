-- CreateTable
CREATE TABLE "StockIssue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT,
    "zone" TEXT,
    "itemId" TEXT,
    "reporterId" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StockIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockIssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockIssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockIssue_organizationId_idx" ON "StockIssue"("organizationId");

-- CreateIndex
CREATE INDEX "StockIssue_sessionId_idx" ON "StockIssue"("sessionId");

-- CreateIndex
CREATE INDEX "StockIssue_status_idx" ON "StockIssue"("status");

-- CreateIndex
CREATE INDEX "StockIssue_createdAt_idx" ON "StockIssue"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "StockIssueComment_issueId_idx" ON "StockIssueComment"("issueId");
