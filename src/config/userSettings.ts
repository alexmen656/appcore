import { prisma } from "./database";
import { decryptNullable } from "./encryption";

export interface EffectiveSettings {
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascVendorNumber: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  aiProvider: "openai" | "anthropic";
}

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

  return {
    ascIssuerId: s?.ascIssuerId ?? "",
    ascKeyId: s?.ascKeyId ?? "",
    ascPrivateKey: decryptNullable(s?.ascPrivateKey) ?? "",
    ascVendorNumber: s?.ascVendorNumber ?? "",
    openaiApiKey: decryptNullable(s?.openaiApiKey) ?? "",
    anthropicApiKey: decryptNullable(s?.anthropicApiKey) ?? "",
    aiProvider: s?.aiProvider === "anthropic" ? "anthropic" : "openai",
  };
}
