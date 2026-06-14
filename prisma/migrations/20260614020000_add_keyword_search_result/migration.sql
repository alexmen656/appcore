-- Full per-scrape search-result snapshot per keyword: one row per app per scrape.
-- Written by the keyword tracker; powers the real top-5 "Top Competitors" in the
-- keyword list and the full ranked-app list/chart in the ranking detail modal.
CREATE TABLE "KeywordSearchResult" (
  "id"        TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "rank"      INTEGER NOT NULL,
  "trackId"   BIGINT,
  "bundleId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "iconUrl"   TEXT,
  "country"   TEXT NOT NULL DEFAULT 'de',
  "trackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KeywordSearchResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KeywordSearchResult_keywordId_trackedAt_idx"
  ON "KeywordSearchResult" ("keywordId", "trackedAt");

CREATE INDEX "KeywordSearchResult_keywordId_bundleId_trackedAt_idx"
  ON "KeywordSearchResult" ("keywordId", "bundleId", "trackedAt" DESC);

ALTER TABLE "KeywordSearchResult"
  ADD CONSTRAINT "KeywordSearchResult_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- KeywordTopApp is superseded by the latest KeywordSearchResult snapshot.
DROP TABLE "KeywordTopApp";
