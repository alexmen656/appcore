import type { Job } from "pg-boss";
import { logger, getEffectiveSettings } from "../../config";
import { syncAllAnalytics } from "../../services/asc-analytics.js";

export const QUEUE_NAME = "sync-analytics";

export interface SyncAnalyticsData {
  userId: string;
  bundleId: string;
  ascAppId: string;
}

export async function handler([job]: Job<SyncAnalyticsData>[]): Promise<void> {
  const { data: { userId, bundleId, ascAppId }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for app ${bundleId}…`);

  const settings = await getEffectiveSettings(userId);

  if (!settings.ascIssuerId || !settings.ascVendorNumber) {
    logger.warn(`[BOSS] ASC not configured for user ${userId} — skipping`);
    return;
  }

  await syncAllAnalytics(settings, bundleId, ascAppId, userId);

  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
