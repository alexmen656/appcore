import { PgBoss } from "pg-boss";
import { logger } from "../config";
import { env } from "../config/env";
import { prisma } from "../config/database";
import {
  QUEUE_NAME as TRACK_KEYWORDS_QUEUE,
  handler as trackKeywordsHandler,
} from "./workers/track-keywords.worker";
import type { TrackKeywordsData } from "./workers/track-keywords.worker";
import {
  QUEUE_NAME as SCRAPE_QUEUE,
  handler as scrapeHandler,
} from "./workers/scrape.worker";
import type { ScrapeData } from "./workers/scrape.worker";
import {
  QUEUE_NAME as SYNC_ANALYTICS_QUEUE,
  handler as syncAnalyticsHandler,
} from "./workers/sync-analytics.worker";
import type { SyncAnalyticsData } from "./workers/sync-analytics.worker";

async function loadTeamApps() {
  return prisma.team.findMany({
    include: {
      apps: { where: { isOwnApp: true } },
      members: { take: 1, select: { userId: true } },
    },
  });
}

export class BossScheduler {
  private boss: InstanceType<typeof PgBoss>;

  constructor() {
    this.boss = new PgBoss({ connectionString: env.DATABASE_URL });
    this.boss.on("error", (err: Error) =>
      logger.error("[BOSS] Unexpected error", { error: err }),
    );
  }

  async start(): Promise<void> {
    await this.boss.start();

    // ── track-keywords ──────────────────────────────────────────────────────
    await this.boss.work(`${TRACK_KEYWORDS_QUEUE}:dispatch`, async () => {
      const teams = await loadTeamApps();
      for (const team of teams) {
        const userId = team.members[0]?.userId;
        if (!userId) continue;
        for (const app of team.apps) {
          const data: TrackKeywordsData = {
            userId,
            appId: app.id,
            bundleId: app.bundleId,
            country: app.country,
          };
          await this.boss.send(TRACK_KEYWORDS_QUEUE, data);
          logger.info(
            `[BOSS] Enqueued ${TRACK_KEYWORDS_QUEUE} for ${app.bundleId}`,
          );
        }
      }
    });
    await this.boss.work(TRACK_KEYWORDS_QUEUE, trackKeywordsHandler);
    await this.boss.schedule(
      `${TRACK_KEYWORDS_QUEUE}:dispatch`,
      "0 */2 * * *",
      {},
      { tz: "Europe/Berlin" },
    );

    // ── scrape ──────────────────────────────────────────────────────────────
    await this.boss.work(`${SCRAPE_QUEUE}:dispatch`, async () => {
      const teams = await loadTeamApps();
      for (const team of teams) {
        for (const app of team.apps) {
          const data: ScrapeData = {
            bundleId: app.bundleId,
            country: app.country,
          };
          await this.boss.send(SCRAPE_QUEUE, data);
          logger.info(`[BOSS] Enqueued ${SCRAPE_QUEUE} for ${app.bundleId}`);
        }
      }
    });
    await this.boss.work(SCRAPE_QUEUE, scrapeHandler);
    await this.boss.schedule(
      `${SCRAPE_QUEUE}:dispatch`,
      "0 0 * * *",
      {},
      { tz: "Europe/Berlin" },
    );

    // ── sync-analytics ──────────────────────────────────────────────────────
    await this.boss.work(`${SYNC_ANALYTICS_QUEUE}:dispatch`, async () => {
      const teams = await loadTeamApps();
      for (const team of teams) {
        const userId = team.members[0]?.userId;
        if (!userId) continue;
        for (const app of team.apps) {
          if (!app.trackId) continue;
          const data: SyncAnalyticsData = {
            userId,
            bundleId: app.bundleId,
            ascAppId: app.trackId.toString(),
          };
          await this.boss.send(SYNC_ANALYTICS_QUEUE, data);
          logger.info(
            `[BOSS] Enqueued ${SYNC_ANALYTICS_QUEUE} for ${app.bundleId}`,
          );
        }
      }
    });
    await this.boss.work(SYNC_ANALYTICS_QUEUE, syncAnalyticsHandler);
    await this.boss.schedule(
      `${SYNC_ANALYTICS_QUEUE}:dispatch`,
      "0 2,6,10,14,18,22 * * *",
      {},
      { tz: "Europe/Berlin" },
    );

    logger.info(
      `[BOSS] Scheduler started — queues: ${TRACK_KEYWORDS_QUEUE}, ${SCRAPE_QUEUE}, ${SYNC_ANALYTICS_QUEUE}`,
    );
  }

  async stop(): Promise<void> {
    await this.boss.stop();
    logger.info("[BOSS] Scheduler stopped");
  }
}
