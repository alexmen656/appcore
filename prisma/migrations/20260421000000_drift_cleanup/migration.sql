-- Drop legacy ScrapeJob table and enum (removed from schema in commit dd602f8)
DROP TABLE IF EXISTS "ScrapeJob";
DROP TYPE IF EXISTS "ScrapeType";

-- Remove legacy ASC app/bundle columns from TeamSettings (removed in commit eb18414)
ALTER TABLE "TeamSettings" DROP COLUMN IF EXISTS "ascAppId";
ALTER TABLE "TeamSettings" DROP COLUMN IF EXISTS "ascBundleId";

-- Add accent color fields to App (added in commit d4501fc)
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "accentColorIconUrl" TEXT;
