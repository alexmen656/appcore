// ─── Scrape Job ─────────────────────────────────────────────────────────
// Scrapes the iTunes API for own app + all competitors, saves snapshots.

import { logger } from "../../config";
import { JobDefinition, buildServices } from "../types";

const scrapeJob: JobDefinition = {
  id: "scrape",
  name: "Full App Scrape",
  schedule: "0 */24 * * *",
  timezone: "Europe/Berlin",

  async execute(_userId, settings) {
    const { scraper } = await buildServices(settings);
    logger.info("[CRON] Starting full scrape job...");
    await scraper.runFullScrapeJob();
    logger.info("[CRON] Full scrape job completed");
  },
};

export default scrapeJob;
