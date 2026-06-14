-- CreateTable
CREATE TABLE "AppInAppPurchase" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'purchase',
    "position" INTEGER NOT NULL DEFAULT 0,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppInAppPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppInAppPurchase_appId_idx" ON "AppInAppPurchase"("appId");

-- AddForeignKey
ALTER TABLE "AppInAppPurchase" ADD CONSTRAINT "AppInAppPurchase_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
