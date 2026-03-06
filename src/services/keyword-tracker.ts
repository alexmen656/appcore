import { prisma, logger, env } from "../config";
import type { EffectiveSettings } from "../config";
import { AppStoreScraper } from "./appstore-scraper";
import { AppleSearchAdsClient } from "./search-ads";
import { ScrapeType, JobStatus } from "@prisma/client";

export class KeywordTracker {
  private scraper: AppStoreScraper;
  private searchAds: AppleSearchAdsClient | null = null;
  private searchAdsPopularity: Map<string, number> | null = null;
  private readonly bundleId: string;
  private readonly country: string;
  private readonly ascAppId: string;

  constructor(settings?: EffectiveSettings) {
    if (settings?.scrapeCountry && settings?.ascBundleId) {
      this.bundleId = settings.ascBundleId;
      this.country = settings.scrapeCountry;
      this.ascAppId = settings.ascAppId ?? "";
    } else {
      logger.warn(
        "[KeywordTracker] No country or bundle ID in settings, keyword tracking will be disabled",
      );
      this.bundleId = "";
      this.country = "";
      this.ascAppId = "";
    }
    this.scraper = new AppStoreScraper(settings ?? this.country);

    if (env.APPLE_ADS_CLIENT_ID) {
      this.searchAds = new AppleSearchAdsClient();
    }
  }

  private async fetchSearchAdsData(): Promise<Map<string, number>> {
    if (this.searchAdsPopularity) return this.searchAdsPopularity;

    this.searchAdsPopularity = new Map();

    if (!this.searchAds) {
      logger.debug("Search Ads not configured, skipping popularity fetch");
      return this.searchAdsPopularity;
    }

    try {
      logger.info("Fetching keyword popularity from Apple Search Ads API...");
      const keywords = await this.searchAds.getTargetingKeywords(
        this.ascAppId,
        200,
      );

      for (const kw of keywords) {
        this.searchAdsPopularity.set(kw.keyword.toLowerCase(), kw.popularity);
      }

      logger.info(
        `Got popularity data for ${keywords.length} keywords from Search Ads`,
      );
    } catch (error) {
      logger.warn("Failed to fetch Search Ads data, will use estimates", {
        error: error instanceof Error ? error.message : error,
      });
    }

    return this.searchAdsPopularity;
  }

  async addKeywords(
    terms: string[],
    country = this.country,
    language?: string,
  ): Promise<number> {
    let added = 0;
    const lang = language ?? country;
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

  async trackKeywordRanking(
    keywordTerm: string,
    country = this.country,
  ): Promise<number | null> {
    const keyword = await prisma.keyword.findUnique({
      where: { term_country: { term: keywordTerm, country } },
    });
    if (!keyword) {
      logger.warn(`Keyword "${keywordTerm}" not found in database`);
      return null;
    }

    const { results, popularity, difficulty, searchVolume } =
      await this.scraper.analyzeKeyword(keywordTerm, 50);

    const searchAdsData = await this.fetchSearchAdsData();
    const realPopularity = searchAdsData.get(keywordTerm.toLowerCase());
    const finalPopularity = realPopularity ?? popularity;

    await prisma.keyword.update({
      where: { id: keyword.id },
      data: {
        popularity: finalPopularity,
        difficulty,
        searchVolume,
      },
    });

    if (realPopularity != null) {
      logger.debug(
        `Keyword "${keywordTerm}": Search Ads popularity = ${realPopularity}`,
      );
    }

    const ownApp = await prisma.app.findUnique({
      where: { bundleId: this.bundleId },
    });

    if (!ownApp) {
      logger.warn("Own app not in database yet");
      return null;
    }

    const rank =
      results.findIndex((r) => r.bundleId === this.bundleId) + 1 || null;

    await prisma.keywordRanking.create({
      data: {
        keywordId: keyword.id,
        appId: ownApp.id,
        rank,
        country,
      },
    });

    const competitors = await prisma.competitorRelation.findMany({
      where: { appId: ownApp.id },
      include: { competitor: true },
    });

    for (const rel of competitors) {
      const compRank =
        results.findIndex((r) => r.bundleId === rel.competitor.bundleId) + 1 ||
        null;

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

    logger.info(`Keyword "${keywordTerm}": our rank = ${rank ?? "not ranked"}`);
    return rank;
  }

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
      const ownApp = await prisma.app.findUnique({
        where: { bundleId: this.bundleId },
      });

      const keywords = await prisma.keyword.findMany({
        where: ownApp ? { rankings: { some: { appId: ownApp.id } } } : {},
      });

      for (const keyword of keywords) {
        const rank = await this.trackKeywordRanking(
          keyword.term,
          keyword.country,
        );
        rankings.set(`${keyword.term}@${keyword.country}`, rank);

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

  async getRankingHistory(
    keywordTerm: string,
    days = 30,
  ): Promise<Array<{ date: Date; rank: number | null; appName: string }>> {
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
      where: { bundleId: this.bundleId },
    });
    if (!ownApp) return [];

    const keywords = await prisma.keyword.findMany({
      where: { country: this.country },
      include: {
        rankings: {
          orderBy: { trackedAt: "desc" },
          take: 50,
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
