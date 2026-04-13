import type { Job } from "pg-boss";
import { logger, getEffectiveSettingsForTeam } from "../../config";
import { syncAllAnalytics } from "../../services/asc-analytics.js";

export const QUEUE_NAME = "sync-analytics";

export interface SyncAnalyticsData {
  teamId: string;
  bundleId: string;
  ascAppId: string;
}

export async function handler([job]: Job<SyncAnalyticsData>[]): Promise<void> {
  const { data: { teamId, bundleId, ascAppId }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for app ${bundleId}…`);

  const settings = await getEffectiveSettingsForTeam(teamId);

  if (!settings.ascIssuerId || !settings.ascVendorNumber) {
    logger.warn(`[BOSS] ASC not configured for team ${teamId} — skipping`);
    return;
  }

  await syncAllAnalytics(settings, bundleId, ascAppId);
  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
