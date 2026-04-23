-- Add preset metadata fields to TeamSettings
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "presetCopyright" TEXT;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerFirstName" TEXT;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerLastName" TEXT;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerPhone" TEXT;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerEmail" TEXT;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerDemoAccountRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerDemoUsername" TEXT;
ALTER TABLE "TeamSettings" ADD COLUMN IF NOT EXISTS "reviewerDemoPassword" TEXT;

-- Add reviewer info and copyright/ageRating fields to AppStoreVersion
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "copyright" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "ageRating" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerFirstName" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerLastName" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerPhone" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerEmail" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerDemoAccountRequired" BOOLEAN;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerDemoUsername" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewerDemoPassword" TEXT;
ALTER TABLE "AppStoreVersion" ADD COLUMN IF NOT EXISTS "reviewDetailId" TEXT;
