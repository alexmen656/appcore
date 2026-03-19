import { prisma } from "./database";

export interface EffectiveSettings {
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascAppId: string;
  ascBundleId: string;
  ascVendorNumber: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  aiProvider: "openai" | "anthropic";
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

async function getTeamIdForUser(userId: string): Promise<string | null> {
  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return membership?.teamId ?? null;
}

export async function getTeamSettings(teamId: string) {
  return prisma.teamSettings.findUnique({ where: { teamId } });
}

export async function getEffectiveSettings(
  userId: string,
): Promise<EffectiveSettings> {
  const teamId = await getTeamIdForUser(userId);
  const s = teamId ? await getTeamSettings(teamId) : null;

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
