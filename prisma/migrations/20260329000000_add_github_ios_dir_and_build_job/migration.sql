-- AlterTable
ALTER TABLE "App" ADD COLUMN "githubIosDir" TEXT;

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeamSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BuildJob" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "branch" TEXT,
    "commitSha" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "logs" TEXT,
    "errors" TEXT,
    "ipaPath" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildJob_appId_createdAt_idx" ON "BuildJob"("appId", "createdAt");

-- AddForeignKey
ALTER TABLE "BuildJob" ADD CONSTRAINT "BuildJob_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
