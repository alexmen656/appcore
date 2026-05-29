CREATE TABLE "AscRateLimit" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "hourLimit" INTEGER NOT NULL,
    "hourRemaining" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AscRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AscRateLimit_teamId_key" ON "AscRateLimit"("teamId");
CREATE INDEX "AscRateLimit_teamId_idx" ON "AscRateLimit"("teamId");
