import { prisma, logger, env } from "../config";
import { AppStoreScraper } from "./appstore-scraper";
import { AppleSearchAdsClient } from "./search-ads";
import { ScrapeType, JobStatus } from "@prisma/client";

// ─── Keyword Tracking Service ───────────────────────────────────────────

export class KeywordTracker {
  private scraper: AppStoreScraper;
  private searchAds: AppleSearchAdsClient | null = null;
  private searchAdsPopularity: Map<string, number> | null = null;

  constructor() {
    this.scraper = new AppStoreScraper();

    // Initialize Search Ads client if credentials are available
    if (env.APPLE_ADS_CLIENT_ID) {
      this.searchAds = new AppleSearchAdsClient();
    }
  }

  /**
   * Fetch keyword popularity data from Apple Search Ads API.
   * Caches results for the duration of a tracking session.
   */
  private async fetchSearchAdsData(): Promise<Map<string, number>> {
    if (this.searchAdsPopularity) return this.searchAdsPopularity;

    this.searchAdsPopularity = new Map();

    if (!this.searchAds) {
      logger.debug("Search Ads not configured, skipping popularity fetch");
      return this.searchAdsPopularity;
    }

    try {
      const appId = env.ASC_APP_ID || "";
      if (!appId) {
        logger.debug("ASC_APP_ID not set, cannot fetch Search Ads keywords");
        return this.searchAdsPopularity;
      }

      logger.info("Fetching keyword popularity from Apple Search Ads API...");
      const keywords = await this.searchAds.getTargetingKeywords(appId, 200);

      for (const kw of keywords) {
        this.searchAdsPopularity.set(kw.keyword.toLowerCase(), kw.popularity);
      }

      logger.info(`Got popularity data for ${keywords.length} keywords from Search Ads`);
    } catch (error) {
      logger.warn("Failed to fetch Search Ads data, will use estimates", {
        error: error instanceof Error ? error.message : error,
      });
    }

    return this.searchAdsPopularity;
  }

  /**
   * Add keywords to track
   */
  async addKeywords(
    terms: string[],
    country = env.SCRAPE_COUNTRY,
    language?: string
  ): Promise<number> {
    let added = 0;
    const lang = language ?? country; // use country code as language fallback
    for (const term of terms) {
      const normalized = term.toLowerCase().trim();
      if (!normalized) continue;

      await prisma.keyword.upsert({
        where: { term_country: { term: normalized, country } },
        create: { term: normalized, country, language: lang },
        update: {},
      });
      added++;
    }
    logger.info(`Added/verified ${added} keywords for tracking`);
    return added;
  }

  /**
   * Track ranking for a specific keyword
   * Searches the App Store, calculates real popularity/difficulty/volume from Apple data
   */
  async trackKeywordRanking(
    keywordTerm: string,
    country = env.SCRAPE_COUNTRY
  ): Promise<number | null> {
    const keyword = await prisma.keyword.findUnique({
      where: { term_country: { term: keywordTerm, country } },
    });
    if (!keyword) {
      logger.warn(`Keyword "${keywordTerm}" not found in database`);
      return null;
    }

    // ── Analyze keyword using Apple data (search results + autocomplete) ──
    const { results, popularity, difficulty, searchVolume } =
      await this.scraper.analyzeKeyword(keywordTerm, 50);

    // Check if Search Ads has better popularity data (overrides estimation)
    const searchAdsData = await this.fetchSearchAdsData();
    const realPopularity = searchAdsData.get(keywordTerm.toLowerCase());
    const finalPopularity = realPopularity ?? popularity;

    // Update keyword metrics in DB
    await prisma.keyword.update({
      where: { id: keyword.id },
      data: {
        popularity: finalPopularity,
        difficulty,
        searchVolume,
      },
    });

    if (realPopularity != null) {
      logger.debug(`Keyword "${keywordTerm}": Search Ads popularity = ${realPopularity}`);
    }

    // Find our app's position
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: env.ASC_BUNDLE_ID },
    });

    if (!ownApp) {
      logger.warn("Own app not in database yet");
      return null;
    }

    const rank =
      results.findIndex((r) => r.bundleId === env.ASC_BUNDLE_ID) + 1 || null;

    // Save ranking
    await prisma.keywordRanking.create({
      data: {
        keywordId: keyword.id,
        appId: ownApp.id,
        rank,
        country,
      },
    });

    // Also track competitor rankings
    const competitors = await prisma.competitorRelation.findMany({
      where: { appId: ownApp.id },
      include: { competitor: true },
    });

    for (const rel of competitors) {
      const compRank =
        results.findIndex(
          (r) => r.bundleId === rel.competitor.bundleId
        ) + 1 || null;

      if (compRank) {
        await prisma.keywordRanking.create({
          data: {
            keywordId: keyword.id,
            appId: rel.competitorId,
            rank: compRank,
            country,
          },
        });
      }
    }

    logger.info(
      `Keyword "${keywordTerm}": our rank = ${rank ?? "not ranked"}`
    );
    return rank;
  }

  /**
   * Track rankings for all monitored keywords
   */
  async trackAllKeywords(): Promise<Map<string, number | null>> {
    const job = await prisma.scrapeJob.create({
      data: {
        type: ScrapeType.KEYWORD_RANKING,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    const rankings = new Map<string, number | null>();

    try {
      const keywords = await prisma.keyword.findMany({
        where: { country: env.SCRAPE_COUNTRY },
      });

      for (const keyword of keywords) {
        const rank = await this.trackKeywordRanking(keyword.term);
        rankings.set(keyword.term, rank);

        // Rate limiting: 1.5 seconds between searches
        await new Promise((r) => setTimeout(r, 1500));
      }

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsCount: keywords.length,
          result: JSON.stringify(Object.fromEntries(rankings)),
        },
      });

      logger.info(`Tracked ${keywords.length} keywords`);
    } catch (error) {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    return rankings;
  }

  /**
   * Get ranking history for a keyword
   */
  async getRankingHistory(
    keywordTerm: string,
    days = 30
  ): Promise<
    Array<{ date: Date; rank: number | null; appName: string }>
  > {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const keyword = await prisma.keyword.findFirst({
      where: { term: keywordTerm },
    });
    if (!keyword) return [];

    const rankings = await prisma.keywordRanking.findMany({
      where: {
        keywordId: keyword.id,
        trackedAt: { gte: since },
      },
      include: { app: true },
      orderBy: { trackedAt: "asc" },
    });

    return rankings.map((r) => ({
      date: r.trackedAt,
      rank: r.rank,
      appName: r.app.name,
    }));
  }

  /**
   * Get summary of current keyword rankings
   */
  async getCurrentRankingSummary(): Promise<
    Array<{
      keyword: string;
      ourRank: number | null;
      popularity: number | null;
      topCompetitor?: string;
      topCompetitorRank?: number;
    }>
  > {
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: env.ASC_BUNDLE_ID },
    });
    if (!ownApp) return [];

    const keywords = await prisma.keyword.findMany({
      where: { country: env.SCRAPE_COUNTRY },
      include: {
        rankings: {
          orderBy: { trackedAt: "desc" },
          take: 50, // latest rankings (multiple apps)
          include: { app: true },
        },
      },
    });

    return keywords.map((kw) => {
      const ourRanking = kw.rankings.find((r) => r.appId === ownApp.id);
      const competitorRankings = kw.rankings
        .filter((r) => r.appId !== ownApp.id && r.rank !== null)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

      return {
        keyword: kw.term,
        ourRank: ourRanking?.rank ?? null,
        popularity: kw.popularity,
        topCompetitor: competitorRankings[0]?.app?.name,
        topCompetitorRank: competitorRankings[0]?.rank ?? undefined,
      };
    });
  }
}
