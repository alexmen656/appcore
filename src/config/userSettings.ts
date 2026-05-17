import { prisma } from "./database";
import { decryptNullable } from "./encryption";

export interface EffectiveSettings {
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascVendorNumber: string;
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

export async function getEffectiveSettingsForTeam(
  teamId: string,
): Promise<EffectiveSettings> {
  const s = await getTeamSettings(teamId);

  return {
    ascIssuerId: s?.ascIssuerId ?? "",
    ascKeyId: s?.ascKeyId ?? "",
    ascPrivateKey: decryptNullable(s?.ascPrivateKey) ?? "",
    ascVendorNumber: s?.ascVendorNumber ?? "",
  };
}

export async function getEffectiveSettings(
  userId: string,
): Promise<EffectiveSettings> {
  const teamId = await getTeamIdForUser(userId);
  if (!teamId) return getEffectiveSettingsForTeam("");
  return getEffectiveSettingsForTeam(teamId);
}
