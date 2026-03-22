-- CreateTable: TeamMemberAppAccess
CREATE TABLE "TeamMemberAppAccess" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMemberAppAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamMemberAppAccess_teamMemberId_appId_key" ON "TeamMemberAppAccess"("teamMemberId", "appId");
CREATE INDEX "TeamMemberAppAccess_teamMemberId_idx" ON "TeamMemberAppAccess"("teamMemberId");

ALTER TABLE "TeamMemberAppAccess" ADD CONSTRAINT "TeamMemberAppAccess_teamMemberId_fkey"
  FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMemberAppAccess" ADD CONSTRAINT "TeamMemberAppAccess_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
