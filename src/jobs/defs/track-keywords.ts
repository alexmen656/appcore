import { logger } from "../../config";
import { JobDefinition, buildServices } from "../types";
import { notificationService } from "../../services/notifications/notification.js";
import { keywordRankChange } from "../../services/notifications/templates.js";
import { prisma } from "../../config/database.js";

const trackKeywordsJob: JobDefinition = {
  id: "track-keywords",
  name: "Track Keyword Rankings",
  schedule: "0 */2 * * *",
  timezone: "Europe/Berlin",

  async execute(userId, settings) {
    const { keywordTracker } = await buildServices(settings);
    const db = prisma;
    logger.info("[CRON] Starting keyword tracking...");

    const ownApp = await db.app.findFirst({ where: { isOwnApp: true } });
    const previousRankings = new Map<string, number | null>();

    if (ownApp) {
      const keywords = await db.keyword.findMany({
        include: {
          rankings: {
            where: { appId: ownApp.id },
            orderBy: { trackedAt: "desc" },
            take: 1,
          },
        },
      });

      for (const kw of keywords) {
        const lastRank = kw.rankings[0]?.rank ?? null;
        previousRankings.set(`${kw.term}@${kw.country}`, lastRank);
      }
    }

    const rankings = await keywordTracker.trackAllKeywords();
    logger.info(`[CRON] Tracked ${rankings.size} keywords for user ${userId}`);

    if (notificationService.isConfigured()) {
      for (const [key, newRank] of rankings) {
        const oldRank = previousRankings.get(key) ?? null;
        if (oldRank !== newRank && (oldRank !== null || newRank !== null)) {
          const [term, country] = key.split("@");
          await keywordRankChange(term, oldRank, newRank, country);
        }
      }
    }
  },
};

export default trackKeywordsJob;
