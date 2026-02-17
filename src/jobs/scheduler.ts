import cron from "node-cron";
import { logger, env } from "../config";
import { AppStoreScraper } from "../services/appstore-scraper";
import { KeywordTracker } from "../services/keyword-tracker";
import { AIAnalyzer } from "../services/ai-analyzer";

// ─── Scheduled Job Orchestrator ─────────────────────────────────────────

export class Scheduler {
  private scraper: AppStoreScraper;
  private keywordTracker: KeywordTracker;
  private aiAnalyzer: AIAnalyzer;
  private jobs: cron.ScheduledTask[] = [];

  constructor() {
    this.scraper = new AppStoreScraper();
    this.keywordTracker = new KeywordTracker();
    this.aiAnalyzer = new AIAnalyzer();
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    const intervalHours = env.SCRAPE_INTERVAL_HOURS;

    // ── Job 1: Scrape all apps (own + competitors) ──────────────────
    // Runs every N hours
    const scrapeJob = cron.schedule(
      `0 */${intervalHours} * * *`,
      async () => {
        logger.info("[CRON] Starting full scrape job...");
        try {
          await this.scraper.runFullScrapeJob();
          logger.info("[CRON] Full scrape job completed");
        } catch (error) {
          logger.error("[CRON] Full scrape job failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      },
      { timezone: "Europe/Berlin" }
    );
    this.jobs.push(scrapeJob);

    // ── Job 2: Track keyword rankings ───────────────────────────────
    // Runs every 6 hours
    const keywordJob = cron.schedule(
      "0 */6 * * *",
      async () => {
        logger.info("[CRON] Starting keyword tracking...");
        try {
          const rankings = await this.keywordTracker.trackAllKeywords();
          logger.info(`[CRON] Tracked ${rankings.size} keywords`);
        } catch (error) {
          logger.error("[CRON] Keyword tracking failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      },
      { timezone: "Europe/Berlin" }
    );
    this.jobs.push(keywordJob);

    // ── Job 3: AI Analysis ──────────────────────────────────────────
    // Runs once daily at 8:00 AM
    const analysisJob = cron.schedule(
      "0 8 * * *",
      async () => {
        logger.info("[CRON] Starting AI ASO analysis...");
        try {
          const results = await this.aiAnalyzer.analyzeAndSuggest();
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
          logger.info(`[CRON] AI analysis complete: ${totalSuggestions} suggestions across ${results.size} locales`);
        } catch (error) {
          logger.error("[CRON] AI analysis failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      },
      { timezone: "Europe/Berlin" }
    );
    this.jobs.push(analysisJob);

    // ── Job 4: Extract competitor keywords (weekly) ─────────────────
    // Runs Mondays at 6:00 AM
    const extractionJob = cron.schedule(
      "0 6 * * 1",
      async () => {
        logger.info("[CRON] Extracting competitor keywords...");
        try {
          const keywords =
            await this.aiAnalyzer.extractKeywordsFromCompetitors();
          if (keywords.length > 0) {
            const terms = keywords.map((k) => k.keyword);
            await this.keywordTracker.addKeywords(terms);
            logger.info(
              `[CRON] Extracted and added ${terms.length} keywords from competitors`
            );
          }
        } catch (error) {
          logger.error("[CRON] Keyword extraction failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      },
      { timezone: "Europe/Berlin" }
    );
    this.jobs.push(extractionJob);

    logger.info(
      `Scheduler started with ${this.jobs.length} jobs (scrape every ${intervalHours}h, keywords every 6h, analysis daily 8am, extraction weekly Monday 6am)`
    );
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info("Scheduler stopped");
  }

  /**
   * Run all jobs once immediately (for testing/initial setup)
   */
  async runAllNow(): Promise<void> {
    logger.info("Running all jobs immediately...");

    logger.info("Step 1/4: Scraping apps...");
    await this.scraper.runFullScrapeJob();

    logger.info("Step 2/4: Tracking keywords...");
    await this.keywordTracker.trackAllKeywords();

    logger.info("Step 3/4: Extracting competitor keywords...");
    const keywords = await this.aiAnalyzer.extractKeywordsFromCompetitors();
    if (keywords.length > 0) {
      await this.keywordTracker.addKeywords(keywords.map((k) => k.keyword));
    }

    logger.info("Step 4/4: Running AI analysis...");
    await this.aiAnalyzer.analyzeAndSuggest();

    logger.info("All jobs completed successfully");
  }
}
