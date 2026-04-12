import type { Job } from "pg-boss";
import { logger, getEffectiveSettings } from "../../config";
import { prisma } from "../../config/database";
import { AppStoreConnectClient } from "../../services/appstore-connect";

export const QUEUE_NAME = "sync-metadata";

export interface SyncMetadataData {
  userId: string;
  bundleId: string;
}

export async function handler([job]: Job<SyncMetadataData>[]): Promise<void> {
  const { data: { userId, bundleId }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for ${bundleId}…`);

  const settings = await getEffectiveSettings(userId);
  if (!settings.ascIssuerId || !settings.ascKeyId || !settings.ascPrivateKey) {
    logger.warn(`[BOSS] ASC credentials not configured for user ${userId}, skipping`);
    return;
  }

  const asc = new AppStoreConnectClient({
    issuerId: settings.ascIssuerId,
    keyId: settings.ascKeyId,
    privateKey: settings.ascPrivateKey,
  });

  const ascApp = await asc.getApp(bundleId).catch(() => null);
  const availableLocalizations = ascApp
    ? await asc.getAppInfoLocalizations(ascApp.id).catch(() => [])
    : [];
  const locales =
    availableLocalizations.length > 0
      ? availableLocalizations
          .map((l: any) => l.attributes?.locale ?? l.locale)
          .filter(Boolean)
      : ["en-US"];

  const primaryState = await asc.getCurrentASOState(locales[0]);
  if (primaryState) {
    await prisma.app.update({
      where: { bundleId },
      data: {
        currentTitle: primaryState.title,
        currentSubtitle: primaryState.subtitle,
        currentKeywords: primaryState.keywords,
        currentDescription: primaryState.description,
      },
    });
    logger.info(`[BOSS] Metadata synced for ${bundleId} (${locales[0]})`);
  }

  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
