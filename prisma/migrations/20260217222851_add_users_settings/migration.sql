-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('TITLE', 'SUBTITLE', 'KEYWORDS', 'DESCRIPTION', 'SCREENSHOT_ORDER');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'APPLIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ScrapeType" AS ENUM ('COMPETITOR_METADATA', 'KEYWORD_RANKING', 'SEARCH_ADS_DATA', 'OWN_APP_SYNC');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ascIssuerId" TEXT,
    "ascKeyId" TEXT,
    "ascPrivateKey" TEXT,
    "ascAppId" TEXT,
    "ascBundleId" TEXT,
    "openaiApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "aiProvider" TEXT DEFAULT 'openai',
    "scrapeCountry" TEXT DEFAULT 'us',
    "scrapeIntervalHours" INTEGER DEFAULT 24,
    "maxCompetitors" INTEGER DEFAULT 20,
    "asoLocales" TEXT DEFAULT 'en-US',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trackId" BIGINT,
    "country" TEXT NOT NULL DEFAULT 'de',
    "isOwnApp" BOOLEAN NOT NULL DEFAULT false,
    "currentTitle" TEXT,
    "currentSubtitle" TEXT,
    "currentKeywords" TEXT,
    "currentDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSnapshot" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "keywords" TEXT,
    "rating" DOUBLE PRECISION,
    "ratingsCount" INTEGER,
    "price" DOUBLE PRECISION,
    "version" TEXT,
    "releaseNotes" TEXT,
    "screenshotUrls" TEXT[],
    "iconUrl" TEXT,
    "developerName" TEXT,
    "category" TEXT,
    "categoryId" INTEGER,
    "descriptionLength" INTEGER,
    "wordCount" INTEGER,
    "readabilityScore" DOUBLE PRECISION,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'de',
    "language" TEXT NOT NULL DEFAULT 'de',
    "popularity" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "searchVolume" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordRanking" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "rank" INTEGER,
    "country" TEXT NOT NULL DEFAULT 'de',
    "trackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorRelation" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ASOSuggestion" (
    "id" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "suggestedValue" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "currentValue" TEXT,
    "keywordId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "estimatedImpact" DOUBLE PRECISION,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "resultNotes" TEXT,
    "aiProvider" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ASOSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "type" "ScrapeType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "error" TEXT,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "App_bundleId_key" ON "App"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "App_trackId_key" ON "App"("trackId");

-- CreateIndex
CREATE INDEX "App_bundleId_idx" ON "App"("bundleId");

-- CreateIndex
CREATE INDEX "App_country_idx" ON "App"("country");

-- CreateIndex
CREATE INDEX "AppSnapshot_appId_scrapedAt_idx" ON "AppSnapshot"("appId", "scrapedAt");

-- CreateIndex
CREATE INDEX "AppSnapshot_scrapedAt_idx" ON "AppSnapshot"("scrapedAt");

-- CreateIndex
CREATE INDEX "Keyword_term_idx" ON "Keyword"("term");

-- CreateIndex
CREATE INDEX "Keyword_popularity_idx" ON "Keyword"("popularity");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_term_country_key" ON "Keyword"("term", "country");

-- CreateIndex
CREATE INDEX "KeywordRanking_keywordId_trackedAt_idx" ON "KeywordRanking"("keywordId", "trackedAt");

-- CreateIndex
CREATE INDEX "KeywordRanking_appId_trackedAt_idx" ON "KeywordRanking"("appId", "trackedAt");

-- CreateIndex
CREATE INDEX "KeywordRanking_trackedAt_idx" ON "KeywordRanking"("trackedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorRelation_appId_competitorId_key" ON "CompetitorRelation"("appId", "competitorId");

-- CreateIndex
CREATE INDEX "ASOSuggestion_type_status_idx" ON "ASOSuggestion"("type", "status");

-- CreateIndex
CREATE INDEX "ASOSuggestion_locale_status_idx" ON "ASOSuggestion"("locale", "status");

-- CreateIndex
CREATE INDEX "ASOSuggestion_createdAt_idx" ON "ASOSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "ScrapeJob_type_status_idx" ON "ScrapeJob"("type", "status");

-- CreateIndex
CREATE INDEX "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSnapshot" ADD CONSTRAINT "AppSnapshot_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRanking" ADD CONSTRAINT "KeywordRanking_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRanking" ADD CONSTRAINT "KeywordRanking_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorRelation" ADD CONSTRAINT "CompetitorRelation_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorRelation" ADD CONSTRAINT "CompetitorRelation_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ASOSuggestion" ADD CONSTRAINT "ASOSuggestion_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
