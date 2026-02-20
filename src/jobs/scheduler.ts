import cron from "node-cron";
import { logger, getEffectiveSettings } from "../config";
import { allJobs } from "./defs";
import { forAllUsers } from "./types";

// ─── Scheduled Job Orchestrator ─────────────────────────────────────────
// Jobs are defined in src/jobs/defs/*.ts

export class Scheduler {
  private tasks: cron.ScheduledTask[] = [];
  private _running = false;

  get running(): boolean {
    return this._running;
  }

  get jobCount(): number {
    return this.tasks.length;
  }

  start(): void {
    if (this._running) return;

    for (const job of allJobs) {
      const task = cron.schedule(
        job.schedule,
        async () => {
          logger.info(`[CRON] Running "${job.name}"…`);
          await forAllUsers(async (userId) => {
            const settings = await getEffectiveSettings(userId);
            await job.execute(userId, settings);
          });
          logger.info(`[CRON] "${job.name}" completed`);
        },
        { timezone: job.timezone },
      );
      this.tasks.push(task);
    }

    const summary = allJobs.map((j) => `${j.id} [${j.schedule}]`).join(", ");
    logger.info(`Scheduler started with ${this.tasks.length} jobs: ${summary}`);
    this._running = true;
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this._running = false;
    logger.info("Scheduler stopped");
  }

  async runAllNow(userId: string): Promise<void> {
    const settings = await getEffectiveSettings(userId);
    logger.info(
      `Running all ${allJobs.length} jobs immediately for user ${userId}…`,
    );

    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      logger.info(`Step ${i + 1}/${allJobs.length}: ${job.name}…`);
      await job.execute(userId, settings);
    }

    logger.info("All jobs completed successfully");
  }
}
