import { logger, prisma } from "../../config";
import { syncAllAnalytics } from "../../services/asc-analytics";
import { JobDefinition } from "../types";

const syncAnalyticsJob: JobDefinition = {
  id: "sync-analytics",
  name: "Sync ASC Analytics",
  schedule: "0 2,6,10,14,18,22 * * *",
  timezone: "Europe/Berlin",

  async execute(userId, settings) {
    logger.info("[CRON] Starting ASC analytics sync...");

    if (!settings.ascIssuerId || !settings.ascVendorNumber) return;

    const ownApps = await prisma.app.findMany({
      where: { isOwnApp: true },
      select: { bundleId: true, trackId: true },
    });

    for (const app of ownApps) {
      const ascAppId = app.trackId?.toString() ?? settings.ascAppId;
      if (!ascAppId) continue;
      await syncAllAnalytics(settings, app.bundleId, ascAppId, userId);
    }

    logger.info("[CRON] ASC analytics sync completed");
  },
};

export default syncAnalyticsJob;
