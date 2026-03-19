-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateTable: Team
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamMember
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamInvite
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- Add teamId to App
ALTER TABLE "App" ADD COLUMN "teamId" TEXT;

-- ── Migrate existing data ──────────────────────────────────────────────────
-- Create a default team for all existing users/apps
DO $$
DECLARE
  default_team_id TEXT := 'default_team_000000000000';
  first_admin_id TEXT;
BEGIN
  -- Create default team
  INSERT INTO "Team" ("id", "name", "updatedAt")
  VALUES (default_team_id, 'My Team', NOW())
  ON CONFLICT DO NOTHING;

  -- Assign all existing users to default team
  -- ADMIN users become OWNER, others become MEMBER
  INSERT INTO "TeamMember" ("id", "teamId", "userId", "role", "createdAt")
  SELECT
    gen_random_uuid()::text,
    default_team_id,
    "id",
    CASE WHEN "role" = 'ADMIN' THEN 'OWNER'::"TeamRole" ELSE 'MEMBER'::"TeamRole" END,
    NOW()
  FROM "User"
  ON CONFLICT DO NOTHING;

  -- Assign all own apps to default team
  UPDATE "App" SET "teamId" = default_team_id WHERE "isOwnApp" = true;
END $$;

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");
CREATE INDEX "TeamInvite_teamId_idx" ON "TeamInvite"("teamId");
CREATE INDEX "TeamInvite_token_idx" ON "TeamInvite"("token");
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");

CREATE INDEX "App_teamId_idx" ON "App"("teamId");

-- ── Foreign Keys ──────────────────────────────────────────────────────────
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "App" ADD CONSTRAINT "App_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Drop old AppMember table if exists ────────────────────────────────────
DROP TABLE IF EXISTS "AppMember";
DROP TYPE IF EXISTS "AppRole";
