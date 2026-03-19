-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "AppMember" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'VIEWER',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppMember_appId_idx" ON "AppMember"("appId");

-- CreateIndex
CREATE INDEX "AppMember_userId_idx" ON "AppMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppMember_appId_userId_key" ON "AppMember"("appId", "userId");

-- AddForeignKey
ALTER TABLE "AppMember" ADD CONSTRAINT "AppMember_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppMember" ADD CONSTRAINT "AppMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
