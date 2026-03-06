import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  ASC_APP_ID: z.string().optional(),

  // Apple Search Ads
  APPLE_ADS_CLIENT_ID: z.string().optional(),
  APPLE_ADS_KEY_PATH: z.string().default("./apple_ads_private_key.pem"),
  APPLE_ADS_KEY_ID: z.string().optional(),
  APPLE_ADS_TEAM_ID: z.string().optional(),
  APPLE_ADS_ORG_ID: z.string().optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_BASE_URL: z.string().optional(),

  // Fastlane Worker (MacOS)
  FASTLANE_WORKER_URL: z.string().url().optional(),
  FASTLANE_WORKER_SECRET: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
