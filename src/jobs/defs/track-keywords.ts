import { logger } from "../../config";
import { JobDefinition, buildServices } from "../types";

const trackKeywordsJob: JobDefinition = {
  id: "track-keywords",
  name: "Track Keyword Rankings",
  schedule: "0 */2 * * *",
  timezone: "Europe/Berlin",

  async execute(userId, settings) {
    const { keywordTracker } = await buildServices(settings);
    logger.info("[CRON] Starting keyword tracking...");
    const rankings = await keywordTracker.trackAllKeywords();
    logger.info(`[CRON] Tracked ${rankings.size} keywords for user ${userId}`);
  },
};

export default trackKeywordsJob;
