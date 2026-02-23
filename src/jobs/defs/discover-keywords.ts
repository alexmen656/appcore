import { logger } from "../../config";
import { JobDefinition, buildServices } from "../types";

const discoverKeywordsJob: JobDefinition = {
  id: "discover-keywords",
  name: "Keyword Discovery Agent",
  schedule: "0 3,11,19 * * *",
  timezone: "Europe/Berlin",

  async execute(_userId, settings) {
    const { discoveryAgent } = await buildServices(settings);
    logger.info("[CRON] Starting keyword discovery...");

    const result = await discoveryAgent.run();
    logger.info(
      `[CRON] Keyword discovery complete: ${result.discovered} found, ${result.scored} qualified, ${result.added} added`,
    );
  },
};

export default discoverKeywordsJob;
