// ─── Competitor Keyword Extraction Job ───────────────────────────────────
// Extracts keywords from competitor metadata via AI and adds them to tracking.

import { logger } from "../../config";
import { JobDefinition, buildServices } from "../types";

const extractKeywordsJob: JobDefinition = {
  id: "extract-keywords",
  name: "Extract Competitor Keywords",
  schedule: "0 6 * * 1",
  timezone: "Europe/Berlin",

  async execute(_userId, settings) {
    const { aiAnalyzer, keywordTracker } = await buildServices(settings);
    logger.info("[CRON] Extracting competitor keywords...");

    const keywords = await aiAnalyzer.extractKeywordsFromCompetitors();
    if (keywords.length > 0) {
      const terms = keywords.map((k) => k.keyword);
      await keywordTracker.addKeywords(terms);
      logger.info(`[CRON] Extracted and added ${terms.length} keywords`);
    } else {
      logger.info("[CRON] No new competitor keywords found");
    }
  },
};

export default extractKeywordsJob;
