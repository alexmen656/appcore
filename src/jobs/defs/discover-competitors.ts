import { logger, prisma } from "../../config";
import { JobDefinition, buildServices } from "../types";

const discoverCompetitorsJob: JobDefinition = {
  id: "discover-competitors",
  name: "Competitor Discovery",
  schedule: "0 5 * * *",
  timezone: "Europe/Berlin",

  async execute(_userId, settings) {
    const { scraper, bundleId } = await buildServices(settings);
    logger.info("[CRON] Starting competitor discovery...");

    const keywords = await prisma.keyword.findMany({
      orderBy: { popularity: "desc" },
      take: 5,
    });

    if (keywords.length === 0) {
      logger.info("[CRON] No keywords available for competitor discovery");
      return;
    }

    const searchTerms = keywords.map((k) => k.term);
    const ids = await scraper.discoverCompetitors(
      searchTerms,
      bundleId,
      4,
    );
    logger.info(
      `[CRON] Competitor discovery complete: ${ids.length} new competitors found`,
    );
  },
};

export default discoverCompetitorsJob;
