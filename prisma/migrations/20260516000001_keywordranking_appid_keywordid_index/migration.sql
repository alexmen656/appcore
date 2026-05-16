-- CreateIndex
CREATE INDEX IF NOT EXISTS "KeywordRanking_appId_keywordId_idx" ON "KeywordRanking"("appId", "keywordId");
