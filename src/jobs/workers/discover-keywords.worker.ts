import type { Job } from "pg-boss";
import { logger, getEffectiveSettingsForTeam } from "../../config";
import { KeywordDiscoveryAgent } from "../../services/keyword-discovery-agent";

export const QUEUE_NAME = "discover-keywords";

export interface DiscoverKeywordsData {
  teamId: string;
  bundleId: string;
}

export async function handler([job]: Job<DiscoverKeywordsData>[]): Promise<void> {
  const { data: { teamId, bundleId }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for ${bundleId}…`);

  const settings = await getEffectiveSettingsForTeam(teamId);
  const result = await new KeywordDiscoveryAgent(bundleId, settings).run();

  logger.info(
    `[BOSS] Keyword discovery for ${bundleId} complete: ${result.discovered} found, ${result.scored} qualified, ${result.added} added`,
  );
  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
