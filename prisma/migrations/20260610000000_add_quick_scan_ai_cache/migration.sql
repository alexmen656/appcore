-- CreateTable
CREATE TABLE "AppQuickScanAi" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppQuickScanAi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppQuickScanAi_appId_key" ON "AppQuickScanAi"("appId");

-- AddForeignKey
ALTER TABLE "AppQuickScanAi" ADD CONSTRAINT "AppQuickScanAi_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
