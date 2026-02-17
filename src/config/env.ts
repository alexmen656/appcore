import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().url(),

  // App Store Connect
  ASC_ISSUER_ID: z.string().optional(),
  ASC_KEY_ID: z.string().optional(),
  ASC_PRIVATE_KEY_PATH: z.string().default("./keys/AuthKey.p8"),
  ASC_APP_ID: z.string().optional(),
  ASC_BUNDLE_ID: z.string().default("eu.control-center.sites.kaloriq"),

  // Apple Search Ads
  APPLE_ADS_CLIENT_ID: z.string().optional(),
  APPLE_ADS_KEY_PATH: z.string().default("./apple_ads_private_key.pem"),
  APPLE_ADS_KEY_ID: z.string().optional(),
  APPLE_ADS_TEAM_ID: z.string().optional(),
  APPLE_ADS_ORG_ID: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),

  // Scraping
  SCRAPE_COUNTRY: z.string().default("de"),
  SCRAPE_INTERVAL_HOURS: z.coerce.number().default(24),
  MAX_COMPETITORS: z.coerce.number().default(20),

  // Multi-locale ASO (comma-separated ASC locales, e.g. "en-US,de-DE,fr-FR")
  ASO_LOCALES: z.string().default("en-US"),

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
