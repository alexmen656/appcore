-- CreateTable: TeamSettings (team-level, replaces UserSettings)
CREATE TABLE "TeamSettings" (
  "id"                TEXT NOT NULL,
  "teamId"            TEXT NOT NULL,
  "ascIssuerId"       TEXT,
  "ascKeyId"          TEXT,
  "ascPrivateKey"     TEXT,
  "ascAppId"          TEXT,
  "ascBundleId"       TEXT,
  "openaiApiKey"      TEXT,
  "anthropicApiKey"   TEXT,
  "aiProvider"        TEXT DEFAULT 'openai',
  "ascVendorNumber"   TEXT,
  "mcpEnabled"        BOOLEAN NOT NULL DEFAULT false,
  "githubAccessToken" TEXT,
  "githubUsername"    TEXT,
  "githubAvatarUrl"   TEXT,
  "githubConnectedAt" TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "TeamSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamSettings_teamId_key" ON "TeamSettings"("teamId");

ALTER TABLE "TeamSettings" ADD CONSTRAINT "TeamSettings_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing UserSettings → TeamSettings (pick the first/oldest team membership per user)
INSERT INTO "TeamSettings" (
  "id", "teamId", "ascIssuerId", "ascKeyId", "ascPrivateKey",
  "ascAppId", "ascBundleId", "openaiApiKey", "anthropicApiKey", "aiProvider",
  "ascVendorNumber", "mcpEnabled", "githubAccessToken", "githubUsername",
  "githubAvatarUrl", "githubConnectedAt", "updatedAt"
)
SELECT DISTINCT ON (tm."teamId")
  gen_random_uuid()::text,
  tm."teamId",
  us."ascIssuerId", us."ascKeyId", us."ascPrivateKey",
  us."ascAppId", us."ascBundleId", us."openaiApiKey", us."anthropicApiKey",
  COALESCE(us."aiProvider", 'openai'),
  us."ascVendorNumber",
  COALESCE(us."mcpEnabled", false),
  us."githubAccessToken", us."githubUsername",
  us."githubAvatarUrl", us."githubConnectedAt",
  NOW()
FROM "UserSettings" us
JOIN "TeamMember" tm ON tm."userId" = us."userId"
ORDER BY tm."teamId", tm."createdAt" ASC
ON CONFLICT DO NOTHING;

-- Drop old UserSettings
DROP TABLE IF EXISTS "UserSettings";
