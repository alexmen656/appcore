import type { Job } from "pg-boss";
import { logger, getEffectiveSettings } from "../../config";
import { CompetitorIntelService } from "../../services/competitor-intel";

export const QUEUE_NAME = "competitor-intel";

export interface CompetitorIntelData {
  userId: string;
  bundleId: string;
}

export async function handler([job]: Job<CompetitorIntelData>[]): Promise<void> {
  const { data: { userId, bundleId }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for ${bundleId}…`);

  const settings = await getEffectiveSettings(userId);
  const intel = new CompetitorIntelService(settings);
  const result = await intel.runFullIntelJob(bundleId);
  logger.info(`[BOSS] Competitor intel for ${bundleId} complete`, result);

  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
