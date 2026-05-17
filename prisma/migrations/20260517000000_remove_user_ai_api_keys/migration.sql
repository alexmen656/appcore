-- AI keys are now managed by Marteso (env vars), not per-team
ALTER TABLE "TeamSettings" DROP COLUMN IF EXISTS "openaiApiKey";
ALTER TABLE "TeamSettings" DROP COLUMN IF EXISTS "anthropicApiKey";
ALTER TABLE "TeamSettings" DROP COLUMN IF EXISTS "aiProvider";
