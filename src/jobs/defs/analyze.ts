// ─── AI Analysis Job ────────────────────────────────────────────────────
// Runs AI-powered ASO analysis and generates optimization suggestions.

import { logger } from "../../config";
import { JobDefinition, buildServices } from "../types";

const analyzeJob: JobDefinition = {
  id: "analyze",
  name: "AI ASO Analysis",
  schedule: "0 8 * * *",
  timezone: "Europe/Berlin",

  async execute(_userId, settings) {
    const { aiAnalyzer } = await buildServices(settings);
    logger.info("[CRON] Starting AI ASO analysis...");

    const results = await aiAnalyzer.analyzeAndSuggest();
    let totalSuggestions = 0;

    for (const [locale, analysis] of results) {
      const count =
        analysis.titleSuggestions.length +
        analysis.subtitleSuggestions.length +
        analysis.keywordSuggestions.length +
        analysis.descriptionSuggestions.length;
      totalSuggestions += count;
      logger.info(`[CRON] ${locale}: ${count} suggestions`);
    }

    logger.info(`[CRON] AI analysis complete: ${totalSuggestions} suggestions`);
  },
};

export default analyzeJob;
