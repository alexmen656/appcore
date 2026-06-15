-- AlterTable
ALTER TABLE "AppStoreVersionLocalization"
  ADD COLUMN "ascScreenshots" JSONB,
  ADD COLUMN "ascScreenshotsSyncedAt" TIMESTAMP(3);
