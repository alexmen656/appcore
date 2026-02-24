import { prisma } from "./database";

export interface EffectiveSettings {
  // App Store Connect
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascAppId: string;
  ascBundleId: string;
  ascVendorNumber: string;
  ascAnalyticsRequestId: string; // persisted ONGOING request ID

  // AI
  openaiApiKey: string;
  anthropicApiKey: string;
  aiProvider: "openai" | "anthropic";

  // Scraping
  scrapeCountry: string;
  scrapeIntervalHours: number;
  maxCompetitors: number;

  // ASO
  asoLocales: string[];
}

const DEFAULTS: EffectiveSettings = {
  ascIssuerId: "",
  ascKeyId: "",
  ascPrivateKey: "",
  ascAppId: "",
  ascBundleId: "",
  ascVendorNumber: "",
  ascAnalyticsRequestId: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  aiProvider: "openai",
  scrapeCountry: "us",
  scrapeIntervalHours: 24,
  maxCompetitors: 20,
  asoLocales: ["en-US"],
};

export async function getEffectiveSettings(
  userId: string,
): Promise<EffectiveSettings> {
  const s = await prisma.userSettings.findUnique({ where: { userId } });

  return {
    ascIssuerId: s?.ascIssuerId ?? DEFAULTS.ascIssuerId,
    ascKeyId: s?.ascKeyId ?? DEFAULTS.ascKeyId,
    ascPrivateKey: s?.ascPrivateKey ?? DEFAULTS.ascPrivateKey,
    ascAppId: s?.ascAppId ?? DEFAULTS.ascAppId,
    ascBundleId: s?.ascBundleId ?? DEFAULTS.ascBundleId,
    ascVendorNumber: s?.ascVendorNumber ?? DEFAULTS.ascVendorNumber,
    ascAnalyticsRequestId: s?.ascAnalyticsRequestId ?? "",
    openaiApiKey: s?.openaiApiKey ?? DEFAULTS.openaiApiKey,
    anthropicApiKey: s?.anthropicApiKey ?? DEFAULTS.anthropicApiKey,
    aiProvider: s?.aiProvider === "anthropic" ? "anthropic" : "openai",
    scrapeCountry: s?.scrapeCountry ?? DEFAULTS.scrapeCountry,
    scrapeIntervalHours: s?.scrapeIntervalHours ?? DEFAULTS.scrapeIntervalHours,
    maxCompetitors: s?.maxCompetitors ?? DEFAULTS.maxCompetitors,
    asoLocales: (s?.asoLocales ?? "en-US")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean),
  };
}
