-- Drop indexes that are either unused (per pg_stat_user_indexes) or fully covered by
-- the new wider indexes below.
DROP INDEX IF EXISTS "KeywordRanking_appId_trackedAt_idx";
DROP INDEX IF EXISTS "KeywordRanking_appId_keywordId_idx";

-- New covering indexes. (appId, keywordId, trackedAt DESC) replaces (appId, keywordId)
-- and speeds up the LATERAL "latest ranking per (app, keyword)" lookup used in the
-- keyword list and the trend query.
CREATE INDEX IF NOT EXISTS "KeywordRanking_appId_keywordId_trackedAt_idx"
  ON "KeywordRanking" ("appId", "keywordId", "trackedAt" DESC);

-- (keywordId, appId, trackedAt DESC) supports the competitor CTE's DISTINCT ON
-- ("keywordId", "appId") ORDER BY ... "trackedAt" DESC pattern.
CREATE INDEX IF NOT EXISTS "KeywordRanking_keywordId_appId_trackedAt_idx"
  ON "KeywordRanking" ("keywordId", "appId", "trackedAt" DESC);
