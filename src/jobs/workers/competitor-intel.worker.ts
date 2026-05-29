import type { Job } from "pg-boss";
import { logger } from "../../config";
import { CompetitorIntelService } from "../../services/competitor-intel";

export const QUEUE_NAME = "competitor-intel";

export interface CompetitorIntelData {
  teamId: string;
  bundleId: string;
}

export async function handler([job]: Job<CompetitorIntelData>[]): Promise<void> {
  const { data: { bundleId }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for ${bundleId}…`);

  const result = await new CompetitorIntelService().runFullIntelJob(bundleId);

  logger.info(`[BOSS] Competitor intel for ${bundleId} complete`, result);
  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
