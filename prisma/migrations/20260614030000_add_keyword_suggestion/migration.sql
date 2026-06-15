-- CreateEnum
CREATE TYPE "KeywordSuggestionStatus" AS ENUM ('PENDING', 'ADDED', 'DISMISSED');

-- CreateTable
CREATE TABLE "KeywordSuggestion" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'de',
    "language" TEXT NOT NULL DEFAULT 'de',
    "popularity" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "searchVolume" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ai_discovery',
    "status" "KeywordSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordSuggestion_appId_status_idx" ON "KeywordSuggestion"("appId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordSuggestion_appId_term_country_key" ON "KeywordSuggestion"("appId", "term", "country");

-- AddForeignKey
ALTER TABLE "KeywordSuggestion" ADD CONSTRAINT "KeywordSuggestion_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
