import { prisma } from "./database";

export interface EffectiveSettings {
  // App Store Connect
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascAppId: string;
  ascBundleId: string;
  ascVendorNumber: string;

  // AI
  openaiApiKey: string;
  anthropicApiKey: string;
  aiProvider: "openai" | "anthropic";

  // Scraping (derived from App model, not user-editable)
  scrapeCountry: string;
}

const DEFAULTS: EffectiveSettings = {
  ascIssuerId: "",
  ascKeyId: "",
  ascPrivateKey: "",
  ascAppId: "",
  ascBundleId: "",
  ascVendorNumber: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  aiProvider: "openai",
  scrapeCountry: "de",
};

export async function getEffectiveSettings(
  userId: string,
): Promise<EffectiveSettings> {
  const s = await prisma.userSettings.findUnique({ where: { userId } });

  const bundleId = s?.ascBundleId ?? "";
  let scrapeCountry = DEFAULTS.scrapeCountry;
  if (bundleId) {
    const app = await prisma.app.findUnique({
      where: { bundleId },
      select: { country: true },
    });
    if (app?.country) scrapeCountry = app.country;
  }

  return {
    ascIssuerId: s?.ascIssuerId ?? DEFAULTS.ascIssuerId,
    ascKeyId: s?.ascKeyId ?? DEFAULTS.ascKeyId,
    ascPrivateKey: s?.ascPrivateKey ?? DEFAULTS.ascPrivateKey,
    ascAppId: s?.ascAppId ?? DEFAULTS.ascAppId,
    ascBundleId: bundleId,
    ascVendorNumber: s?.ascVendorNumber ?? DEFAULTS.ascVendorNumber,
    openaiApiKey: s?.openaiApiKey ?? DEFAULTS.openaiApiKey,
    anthropicApiKey: s?.anthropicApiKey ?? DEFAULTS.anthropicApiKey,
    aiProvider: s?.aiProvider === "anthropic" ? "anthropic" : "openai",
    scrapeCountry,
  };
}
