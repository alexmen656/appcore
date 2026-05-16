-- CreateTable: Subscription (one-to-one with Team, mirrors Lemon Squeezy state)
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                      TEXT NOT NULL,
  "teamId"                  TEXT NOT NULL,
  "lemonSubscriptionId"     TEXT NOT NULL,
  "lemonCustomerId"         TEXT NOT NULL,
  "lemonOrderId"            TEXT,
  "lemonProductId"          TEXT,
  "lemonVariantId"          TEXT,
  "status"                  TEXT NOT NULL,
  "interval"                TEXT,
  "cardBrand"               TEXT,
  "cardLastFour"            TEXT,
  "renewsAt"                TIMESTAMP(3),
  "endsAt"                  TIMESTAMP(3),
  "trialEndsAt"             TIMESTAMP(3),
  "updatePaymentMethodUrl"  TEXT,
  "customerPortalUrl"       TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_teamId_key" ON "Subscription"("teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_lemonSubscriptionId_key" ON "Subscription"("lemonSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_lemonCustomerId_idx" ON "Subscription"("lemonCustomerId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_teamId_fkey'
  ) THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
