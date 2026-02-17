import axios from "axios";
import * as cheerio from "cheerio";
import { prisma, logger, env } from "../config";
import { ScrapeType, JobStatus } from "@prisma/client";

// ─── iTunes Search API types ────────────────────────────────────────────

interface ITunesResult {
  trackId: number;
  trackName: string;
  bundleId: string;
  sellerName: string;
  description: string;
  averageUserRating?: number;
  userRatingCount?: number;
  price: number;
  version: string;
  releaseNotes?: string;
  screenshotUrls: string[];
  artworkUrl512: string;
  primaryGenreName: string;
  primaryGenreId: number;
  genres: string[];
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesResult[];
}

// ─── App Store Scraper Service ──────────────────────────────────────────

export class AppStoreScraper {
  private readonly baseUrl = "https://itunes.apple.com";
  private readonly country: string;
  private readonly language: string;

  constructor(country?: string, language?: string) {
    this.country = country ?? env.SCRAPE_COUNTRY;
    this.language = language ?? env.SCRAPE_LANGUAGE;
  }

  /**
   * Search the App Store via iTunes Search API
   */
  async searchApps(term: string, limit = 25): Promise<ITunesResult[]> {
    const url = `${this.baseUrl}/search`;
    const { data } = await axios.get<ITunesSearchResponse>(url, {
      params: {
        term,
        country: this.country,
        media: "software",
        limit,
        lang: this.language,
      },
    });
    logger.debug(`Search "${term}" returned ${data.resultCount} results`);
    return data.results;
  }

  /**
   * Lookup a specific app by bundle ID
   */
  async lookupByBundleId(bundleId: string): Promise<ITunesResult | null> {
    const url = `${this.baseUrl}/lookup`;
    const { data } = await axios.get<ITunesSearchResponse>(url, {
      params: {
        bundleId,
        country: this.country,
        lang: this.language,
      },
    });
    return data.results[0] ?? null;
  }

  /**
   * Lookup by Apple track ID
   */
  async lookupByTrackId(trackId: number): Promise<ITunesResult | null> {
    const url = `${this.baseUrl}/lookup`;
    const { data } = await axios.get<ITunesSearchResponse>(url, {
      params: {
        id: trackId,
        country: this.country,
        lang: this.language,
      },
    });
    return data.results[0] ?? null;
  }

  /**
   * Scrape the full App Store web page for additional data (subtitle, etc.)
   */
  async scrapeAppStorePage(trackId: number): Promise<{
    subtitle?: string;
    fullDescription?: string;
    whatsNew?: string;
    ratings?: { average: number; count: number };
  } | null> {
    try {
      const url = `https://apps.apple.com/${this.country}/app/id${trackId}`;
      const { data: html } = await axios.get<string>(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept-Language": `${this.language},en;q=0.9`,
        },
      });

      const $ = cheerio.load(html);

      // Extract subtitle
      const subtitle =
        $('h2[class*="subtitle"]').text().trim() ||
        $(".app-header__subtitle").text().trim() ||
        undefined;

      // Extract full description
      const fullDescription =
        $('[data-test-id="description"] .we-truncate__child').text().trim() ||
        $(".section__description .we-truncate__child").text().trim() ||
        undefined;

      // Extract "What's New"
      const whatsNew =
        $('[data-test-id="version-notes"]').text().trim() || undefined;

      return { subtitle, fullDescription, whatsNew };
    } catch (error) {
      logger.warn(`Failed to scrape App Store page for track ${trackId}`, {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Scrape a single app and save snapshot to DB
   */
  async scrapeAndSaveApp(
    bundleId: string,
    isOwnApp = false
  ): Promise<string | null> {
    const itunesData = await this.lookupByBundleId(bundleId);
    if (!itunesData) {
      logger.warn(`App not found: ${bundleId}`);
      return null;
    }

    // Upsert the app record
    const app = await prisma.app.upsert({
      where: { bundleId },
      create: {
        bundleId,
        name: itunesData.trackName,
        trackId: BigInt(itunesData.trackId),
        country: this.country,
        isOwnApp,
        currentTitle: itunesData.trackName,
        currentDescription: itunesData.description,
      },
      update: {
        name: itunesData.trackName,
        trackId: BigInt(itunesData.trackId),
        currentTitle: itunesData.trackName,
        currentDescription: itunesData.description,
      },
    });

    // Scrape web page for extra data
    const webData = await this.scrapeAppStorePage(itunesData.trackId);

    if (webData?.subtitle) {
      await prisma.app.update({
        where: { id: app.id },
        data: { currentSubtitle: webData.subtitle },
      });
    }

    // Create snapshot
    const description = itunesData.description;
    await prisma.appSnapshot.create({
      data: {
        appId: app.id,
        title: itunesData.trackName,
        subtitle: webData?.subtitle,
        description,
        rating: itunesData.averageUserRating,
        ratingsCount: itunesData.userRatingCount,
        price: itunesData.price,
        version: itunesData.version,
        releaseNotes: itunesData.releaseNotes ?? webData?.whatsNew,
        screenshotUrls: itunesData.screenshotUrls,
        iconUrl: itunesData.artworkUrl512,
        developerName: itunesData.sellerName,
        category: itunesData.primaryGenreName,
        categoryId: itunesData.primaryGenreId,
        descriptionLength: description.length,
        wordCount: description.split(/\s+/).length,
      },
    });

    logger.info(
      `Scraped and saved: ${itunesData.trackName} (${bundleId})`
    );
    return app.id;
  }

  /**
   * Find and scrape competitor apps based on search terms
   */
  async discoverCompetitors(
    searchTerms: string[],
    ownBundleId: string,
    maxResults = 20
  ): Promise<string[]> {
    const seen = new Set<string>();
    const competitorIds: string[] = [];

    for (const term of searchTerms) {
      const results = await this.searchApps(term, 10);

      for (const result of results) {
        if (result.bundleId === ownBundleId || seen.has(result.bundleId)) {
          continue;
        }
        seen.add(result.bundleId);

        if (competitorIds.length >= maxResults) break;

        const appId = await this.scrapeAndSaveApp(result.bundleId, false);
        if (appId) competitorIds.push(appId);
      }

      if (competitorIds.length >= maxResults) break;

      // Rate limiting
      await this.sleep(1000);
    }

    // Establish competitor relationships
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: ownBundleId },
    });

    if (ownApp) {
      for (const competitorId of competitorIds) {
        await prisma.competitorRelation.upsert({
          where: {
            appId_competitorId: {
              appId: ownApp.id,
              competitorId,
            },
          },
          create: {
            appId: ownApp.id,
            competitorId,
          },
          update: {},
        });
      }
    }

    logger.info(
      `Discovered ${competitorIds.length} competitors for "${ownBundleId}"`
    );
    return competitorIds;
  }

  /**
   * Run a full scrape job: own app + all tracked competitors
   */
  async runFullScrapeJob(): Promise<void> {
    const job = await prisma.scrapeJob.create({
      data: { type: ScrapeType.COMPETITOR_METADATA, status: JobStatus.RUNNING, startedAt: new Date() },
    });

    try {
      // Scrape our own app
      await this.scrapeAndSaveApp(env.ASC_BUNDLE_ID, true);

      // Scrape all tracked competitors
      const ownApp = await prisma.app.findUnique({
        where: { bundleId: env.ASC_BUNDLE_ID },
        include: { competitors: { include: { competitor: true } } },
      });

      let count = 1;
      if (ownApp) {
        for (const rel of ownApp.competitors) {
          await this.scrapeAndSaveApp(rel.competitor.bundleId, false);
          count++;
          await this.sleep(500); // Rate limiting
        }
      }

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsCount: count,
          result: JSON.stringify({ appsScraped: count }),
        },
      });

      logger.info(`Full scrape job completed: ${count} apps scraped`);
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
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
