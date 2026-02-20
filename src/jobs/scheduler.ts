import cron from "node-cron";
import { logger, prisma, getEffectiveSettings } from "../config";
import { AppStoreScraper } from "../services/appstore-scraper";
import { KeywordTracker } from "../services/keyword-tracker";
import { AIAnalyzer } from "../services/ai-analyzer";
import { KeywordDiscoveryAgent } from "../services/keyword-discovery-agent";
import { syncAllAnalytics } from "../services/asc-analytics";

// ─── Scheduled Job Orchestrator ─────────────────────────────────────────

export class Scheduler {
  private jobs: cron.ScheduledTask[] = [];
  private _running = false;

  get running(): boolean {
    return this._running;
  }

  get jobCount(): number {
    return this.jobs.length;
  }

  private async getServicesForUser(userId: string) {
    const settings = await getEffectiveSettings(userId);
    return {
      settings,
      scraper: new AppStoreScraper(settings),
      keywordTracker: new KeywordTracker(settings),
      aiAnalyzer: new AIAnalyzer(settings),
      discoveryAgent: new KeywordDiscoveryAgent(settings),
    };
  }

  private async forAllUsers(fn: (userId: string) => Promise<void>) {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      try {
        await fn(user.id);
      } catch (error) {
        logger.error(`[CRON] Job failed for user ${user.id}`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  start(): void {
    if (this._running) return;
    const intervalHours = 24;

    // ── Job 1: Scrape all apps (own + competitors) ──────────────────
    const scrapeJob = cron.schedule(
      `0 */${intervalHours} * * *`,
      async () => {
        logger.info("[CRON] Starting full scrape job...");
        await this.forAllUsers(async (userId) => {
          const { scraper } = await this.getServicesForUser(userId);
          await scraper.runFullScrapeJob();
        });
        logger.info("[CRON] Full scrape job completed");
      },
      { timezone: "Europe/Berlin" },
    );
    this.jobs.push(scrapeJob);

    // ── Job 2: Track keyword rankings ───────────────────────────────
    const keywordJob = cron.schedule(
      "0 */6 * * *",
      async () => {
        logger.info("[CRON] Starting keyword tracking...");
        await this.forAllUsers(async (userId) => {
          const { keywordTracker } = await this.getServicesForUser(userId);
          const rankings = await keywordTracker.trackAllKeywords();
          logger.info(
            `[CRON] Tracked ${rankings.size} keywords for user ${userId}`,
          );
        });
      },
      { timezone: "Europe/Berlin" },
    );
    this.jobs.push(keywordJob);

    // ── Job 3: AI Analysis ──────────────────────────────────────────
    const analysisJob = cron.schedule(
      "0 8 * * *",
      async () => {
        logger.info("[CRON] Starting AI ASO analysis...");
        await this.forAllUsers(async (userId) => {
          const { aiAnalyzer } = await this.getServicesForUser(userId);
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
          logger.info(
            `[CRON] AI analysis complete: ${totalSuggestions} suggestions`,
          );
        });
      },
      { timezone: "Europe/Berlin" },
    );
    this.jobs.push(analysisJob);

    // ── Job 4: Extract competitor keywords (weekly) ─────────────────
    const extractionJob = cron.schedule(
      "0 6 * * 1",
      async () => {
        logger.info("[CRON] Extracting competitor keywords...");
        await this.forAllUsers(async (userId) => {
          const { aiAnalyzer, keywordTracker } =
            await this.getServicesForUser(userId);
          const keywords = await aiAnalyzer.extractKeywordsFromCompetitors();
          if (keywords.length > 0) {
            const terms = keywords.map((k) => k.keyword);
            await keywordTracker.addKeywords(terms);
            logger.info(`[CRON] Extracted and added ${terms.length} keywords`);
          }
        });
      },
      { timezone: "Europe/Berlin" },
    );
    this.jobs.push(extractionJob);

    // ── Job 5: Keyword discovery (AI + autocomplete + competitor mining) ─
    const discoveryJob = cron.schedule(
      "0 3,11,19 * * *",
      async () => {
        logger.info("[CRON] Starting keyword discovery...");
        await this.forAllUsers(async (userId) => {
          const { discoveryAgent } = await this.getServicesForUser(userId);
          const result = await discoveryAgent.run();
          logger.info(
            `[CRON] Keyword discovery complete: ${result.discovered} found, ${result.scored} qualified, ${result.added} added`,
          );
        });
      },
      { timezone: "Europe/Berlin" },
    );
    this.jobs.push(discoveryJob);

    // ── Job 6: Sync ASC analytics (sales reports + reviews) ─────────────
    // Runs every 8 hours: 2am, 10am, 6pm
    const analyticsJob = cron.schedule(
      "0 2,10,18 * * *",
      async () => {
        logger.info("[CRON] Starting ASC analytics sync...");
        try {
          const ownApps = await prisma.app.findMany({
            where: { isOwnApp: true },
            select: { bundleId: true, trackId: true },
          });
          const users = await prisma.user.findMany({ select: { id: true } });
          for (const user of users) {
            const settings = await getEffectiveSettings(user.id);
            if (!settings.ascIssuerId || !settings.ascVendorNumber) continue;
            for (const app of ownApps) {
              const ascAppId = app.trackId?.toString() ?? settings.ascAppId;
              if (!ascAppId) continue;
              await syncAllAnalytics(settings, app.bundleId, ascAppId);
            }
          }
          logger.info("[CRON] ASC analytics sync completed");
        } catch (error) {
          logger.error("[CRON] ASC analytics sync failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      },
      { timezone: "Europe/Berlin" },
    );
    this.jobs.push(analyticsJob);

    logger.info(
      `Scheduler started with ${this.jobs.length} jobs (scrape every ${intervalHours}h, keywords every 6h, analysis daily 8am, extraction weekly Monday 6am, discovery 3×daily, analytics every 8h)`,
    );
    this._running = true;
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    this._running = false;
    logger.info("Scheduler stopped");
  }

  async runAllNow(userId: string): Promise<void> {
    logger.info(`Running all jobs immediately for user ${userId}...`);
    const { scraper, keywordTracker, aiAnalyzer, discoveryAgent } =
      await this.getServicesForUser(userId);

    logger.info("Step 1/5: Scraping apps...");
    await scraper.runFullScrapeJob();

    logger.info("Step 2/5: Tracking keywords...");
    await keywordTracker.trackAllKeywords();

    logger.info("Step 3/5: Extracting competitor keywords...");
    const keywords = await aiAnalyzer.extractKeywordsFromCompetitors();
    if (keywords.length > 0) {
      await keywordTracker.addKeywords(keywords.map((k) => k.keyword));
    }

    logger.info("Step 4/5: Running AI analysis...");
    await aiAnalyzer.analyzeAndSuggest();

    logger.info("Step 5/5: Running keyword discovery...");
    await discoveryAgent.run();

    logger.info("All jobs completed successfully");
  }
}
