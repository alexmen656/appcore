import type { Job } from "pg-boss";
import { logger, getEffectiveSettings } from "../../config";
import { AIAnalyzer } from "../../services/ai-analyzer";
import { KeywordTracker } from "../../services/keyword-tracker";

export const QUEUE_NAME = "extract-keywords";

export interface ExtractKeywordsData {
  userId: string;
  bundleId: string;
  country: string;
}

export async function handler([job]: Job<ExtractKeywordsData>[]): Promise<void> {
  const { data: { userId, bundleId, country }, id } = job;
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for ${bundleId}…`);

  const settings = await getEffectiveSettings(userId);
  const keywordTracker = new KeywordTracker(bundleId, country, settings);

  const keywords = await new AIAnalyzer(bundleId, settings).extractKeywordsFromCompetitors();
  if (keywords.length > 0) {
    const terms = keywords.map((k) => k.keyword);
    await keywordTracker.addKeywords(terms);
    logger.info(`[BOSS] Extracted and added ${terms.length} keywords for ${bundleId}`);
  } else {
    logger.info(`[BOSS] No new competitor keywords found for ${bundleId}`);
  }

  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
