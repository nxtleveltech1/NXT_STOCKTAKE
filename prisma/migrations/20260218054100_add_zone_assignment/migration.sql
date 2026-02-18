-- CreateTable
CREATE TABLE IF NOT EXISTS "ZoneAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ZoneAssignment_organizationId_zoneCode_key" ON "ZoneAssignment"("organizationId", "zoneCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoneAssignment_organizationId_idx" ON "ZoneAssignment"("organizationId");
