-- Speeds up "latest ranking per (appId, keywordId)" — used in keyword list, trend.
CREATE INDEX IF NOT EXISTS "KeywordRanking_appId_keywordId_trackedAt_idx"
  ON "KeywordRanking" ("appId", "keywordId", "trackedAt" DESC);

-- Speeds up "latest ranking per (keywordId, appId)" — used in competitor CTE.
CREATE INDEX IF NOT EXISTS "KeywordRanking_keywordId_appId_trackedAt_idx"
  ON "KeywordRanking" ("keywordId", "appId", "trackedAt" DESC);
