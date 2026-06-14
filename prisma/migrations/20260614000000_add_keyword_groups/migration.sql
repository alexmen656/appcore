-- CreateTable
CREATE TABLE "KeywordGroup" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,

    CONSTRAINT "KeywordGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordGroup_appId_idx" ON "KeywordGroup"("appId");

-- CreateIndex
CREATE INDEX "KeywordGroupMember_groupId_idx" ON "KeywordGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "KeywordGroupMember_keywordId_idx" ON "KeywordGroupMember"("keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordGroupMember_appId_keywordId_key" ON "KeywordGroupMember"("appId", "keywordId");

-- AddForeignKey
ALTER TABLE "KeywordGroup" ADD CONSTRAINT "KeywordGroup_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordGroupMember" ADD CONSTRAINT "KeywordGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "KeywordGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordGroupMember" ADD CONSTRAINT "KeywordGroupMember_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
