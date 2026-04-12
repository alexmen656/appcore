import type { Job } from "pg-boss";
import { logger, getEffectiveSettings } from "../../config";
import { notificationService } from "../../services/notifications/notification.js";
import { keywordRankChange } from "../../services/notifications/templates.js";
import { prisma } from "../../config/database.js";
import { KeywordTracker } from "../../services/keyword-tracker.js";

export const QUEUE_NAME = "track-keywords";

export interface TrackKeywordsData {
  userId: string;
  appId: string;
  bundleId: string;
  country: string;
}

export async function handler(jobs: Job<TrackKeywordsData>[]): Promise<void> {
  const {
    data: { userId, appId, bundleId, country },
    id,
  } = jobs[0];
  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} for app ${bundleId}…`);

  const settings = await getEffectiveSettings(userId);
  const previousRankings = new Map<string, number | null>();
  const keywords = await prisma.keyword.findMany({
    include: {
      rankings: {
        where: { appId },
        orderBy: { trackedAt: "desc" },
        take: 1,
      },
    },
  });
  for (const kw of keywords) {
    previousRankings.set(
      `${kw.term}@${kw.country}`,
      kw.rankings[0]?.rank ?? null,
    );
  }

  const rankings = await new KeywordTracker(
    bundleId,
    country,
    settings,
  ).trackAllKeywords();
  logger.info(`[BOSS] Tracked ${rankings.size} keywords for app ${bundleId}`);

  if (notificationService.isConfigured()) {
    for (const [key, newRank] of rankings) {
      const oldRank = previousRankings.get(key) ?? null;
      if (oldRank !== newRank && (oldRank !== null || newRank !== null)) {
        const [term, appCountry] = key.split("@");
        await keywordRankChange(term, oldRank, newRank, appCountry);
      }
    }
  }

  logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed`);
}
