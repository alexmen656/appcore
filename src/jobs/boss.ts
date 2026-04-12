import { PgBoss } from "pg-boss";
import { logger } from "../config";
import { env } from "../config/env";
import { prisma } from "../config/database";
import {
  QUEUE_NAME as TRACK_KEYWORDS_QUEUE,
  handler as trackKeywordsHandler,
} from "./workers/track-keywords.worker";
import type { TrackKeywordsData } from "./workers/track-keywords.worker";

const DISPATCH_QUEUE = `${TRACK_KEYWORDS_QUEUE}:dispatch`;

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

    await this.boss.work(DISPATCH_QUEUE, async () => {
      const teams = await prisma.team.findMany({
        include: {
          apps: { where: { isOwnApp: true } },
          members: { take: 1, select: { userId: true } },
        },
      });

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
            `[BOSS] Enqueued ${TRACK_KEYWORDS_QUEUE} for app ${app.bundleId}`,
          );
        }
      }
    });

    await this.boss.work(TRACK_KEYWORDS_QUEUE, trackKeywordsHandler);

    await this.boss.schedule(
      DISPATCH_QUEUE,
      "0 */2 * * *",
      {},
      { tz: "Europe/Berlin" },
    );

    logger.info(
      `[BOSS] Scheduler started — dispatch: ${DISPATCH_QUEUE} [0 */2 * * *]`,
    );
  }

  async stop(): Promise<void> {
    await this.boss.stop();
    logger.info("[BOSS] Scheduler stopped");
  }
}
