import { logger, prisma } from "../config";
import type { EffectiveSettings } from "../config";
import { AppStoreScraper } from "../services/appstore-scraper";
import { KeywordTracker } from "../services/keyword-tracker";
import { AIAnalyzer } from "../services/ai-analyzer";
import { KeywordDiscoveryAgent } from "../services/keyword-discovery-agent";

export interface JobDefinition {
  id: string;
  name: string;
  schedule: string;
  timezone: string;
  execute: (userId: string, settings: EffectiveSettings) => Promise<void>;
}

export async function buildServices(settings: EffectiveSettings) {
  const ownApp = await prisma.app.findFirst({
    where: { isOwnApp: true },
    select: { bundleId: true, country: true },
  });
  const bundleId = ownApp?.bundleId ?? "";
  const country = ownApp?.country ?? "de";

  return {
    bundleId,
    scraper: new AppStoreScraper(country, undefined, bundleId),
    keywordTracker: new KeywordTracker(bundleId, country, settings),
    aiAnalyzer: new AIAnalyzer(bundleId, settings),
    discoveryAgent: new KeywordDiscoveryAgent(bundleId, settings),
  };
}

export async function forAllUsers(fn: (userId: string) => Promise<void>) {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    try {
      await fn(user.id);
    } catch (error) {
      logger.error(`[CRON] Job failed for user ${user.id}`, {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
