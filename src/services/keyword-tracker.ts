import { prisma, logger, env } from "../config";
import { AppStoreScraper } from "./appstore-scraper";
import { ScrapeType, JobStatus } from "@prisma/client";

// ─── Keyword Tracking Service ───────────────────────────────────────────

export class KeywordTracker {
  private scraper: AppStoreScraper;

  constructor() {
    this.scraper = new AppStoreScraper();
  }

  /**
   * Add keywords to track
   */
  async addKeywords(
    terms: string[],
    country = env.SCRAPE_COUNTRY,
    language = env.SCRAPE_LANGUAGE
  ): Promise<number> {
    let added = 0;
    for (const term of terms) {
      const normalized = term.toLowerCase().trim();
      if (!normalized) continue;

      await prisma.keyword.upsert({
        where: { term_country: { term: normalized, country } },
        create: { term: normalized, country, language },
        update: {},
      });
      added++;
    }
    logger.info(`Added/verified ${added} keywords for tracking`);
    return added;
  }

  /**
   * Track ranking for a specific keyword
   * Searches the App Store and finds our app's position
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

    // Search the App Store for this keyword
    const results = await this.scraper.searchApps(keywordTerm, 25);

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
