import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z
    .string()
    .min(32)
    .default("appcore-dev-secret-change-me-in-production-32x"),
  WEBAUTHN_RP_ID: z.string().default("localhost"),
  WEBAUTHN_RP_NAME: z.string().default("AppCore"),
  WEBAUTHN_ORIGIN: z.string().default("http://localhost:5173"),

  // Apple Search Ads
  APPLE_ADS_CLIENT_ID: z.string().optional(),
  APPLE_ADS_KEY_PATH: z.string().default("./keys/apple_ads_private_key.pem"),
  APPLE_ADS_KEY_ID: z.string().optional(),
  APPLE_ADS_TEAM_ID: z.string().optional(),
  APPLE_ADS_ORG_ID: z.string().optional(),

  // APNs
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_BUNDLE_ID: z.string().default("com.fringelo.marteso.Marteso"),
  APNS_KEY_PATH: z.string().default("./keys/AuthKey.p8"),
  APNS_HOST: z
    .string()
    .default("api.sandbox.push.apple.com"),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_BASE_URL: z.string().optional(),

  // Fastlane Worker (MacOS)
  FASTLANE_WORKER_URL: z.string().url().optional(),
  FASTLANE_WORKER_SECRET: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("noreply@marteso.com"),
  APP_URL: z.string().default("http://localhost:5173"),

  // node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: z.string().length(64).optional(),

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
