-- Materialized top-5 competitor apps per keyword. Refreshed by the keyword tracker
-- after each per-keyword scrape; read by the /keywords list endpoint.
CREATE TABLE "KeywordTopApp" (
  "keywordId" TEXT NOT NULL,
  "appId"     TEXT NOT NULL,
  "rank"      INTEGER NOT NULL,

  CONSTRAINT "KeywordTopApp_pkey" PRIMARY KEY ("keywordId", "appId")
);

CREATE INDEX "KeywordTopApp_keywordId_rank_idx"
  ON "KeywordTopApp" ("keywordId", "rank");

ALTER TABLE "KeywordTopApp"
  ADD CONSTRAINT "KeywordTopApp_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KeywordTopApp"
  ADD CONSTRAINT "KeywordTopApp_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing rankings: top 5 apps per keyword by latest non-null rank.
INSERT INTO "KeywordTopApp" ("keywordId", "appId", "rank")
WITH latest_per_app AS (
  SELECT DISTINCT ON ("keywordId", "appId")
    "keywordId", "appId", rank
  FROM "KeywordRanking"
  WHERE rank IS NOT NULL
  ORDER BY "keywordId", "appId", "trackedAt" DESC
),
ranked AS (
  SELECT
    "keywordId", "appId", rank,
    ROW_NUMBER() OVER (PARTITION BY "keywordId" ORDER BY rank ASC) AS rn
  FROM latest_per_app
)
SELECT "keywordId", "appId", rank
FROM ranked
WHERE rn <= 5;
