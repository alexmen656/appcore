import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { prisma, logger, env } from "../config";
import type { EffectiveSettings } from "../config";
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

// ─── Country → Language mapping ─────────────────────────────────────────

const COUNTRY_LANG: Record<string, string> = {
  us: "en", gb: "en", au: "en", ca: "en", nz: "en", ie: "en", za: "en", sg: "en", in: "en",
  de: "de", at: "de", ch: "de",
  fr: "fr", be: "fr",
  es: "es", mx: "es", ar: "es", cl: "es", co: "es",
  pt: "pt", br: "pt",
  it: "it",
  nl: "nl",
  ja: "ja", jp: "ja",
  ko: "ko", kr: "ko",
  zh: "zh", cn: "zh", tw: "zh", hk: "zh",
  ru: "ru",
  tr: "tr",
  pl: "pl",
  sv: "sv", se: "sv",
  no: "no",
  da: "da", dk: "da",
  fi: "fi",
  th: "th",
  id: "id",
  vi: "vi", vn: "vi",
  ms: "ms", my: "ms",
  el: "el", gr: "el",
  he: "he", il: "he",
  sa: "ar", ae: "ar", eg: "ar",
  hi: "hi",
  uk: "uk", ua: "uk",
  cs: "cs", cz: "cs",
  sk: "sk",
  ro: "ro",
  hu: "hu",
  hr: "hr",
  bg: "bg",
};

function langForCountry(country: string): string {
  return COUNTRY_LANG[country.toLowerCase()] ?? "en";
}

// ─── Apple Store-Front IDs (for search hints API) ───────────────────────
// Format: "storeFrontId-languageParam,version"
const STOREFRONT: Record<string, string> = {
  us: "143441-1,29", gb: "143444-2,29", au: "143460-27,29", ca: "143455-6,29",
  de: "143443-4,29", at: "143445-4,29", ch: "143459-4,29",
  fr: "143442-3,29", be: "143446-3,29",
  es: "143454-8,29", mx: "143468-28,29",
  pt: "143453-24,29", br: "143503-15,29",
  it: "143450-7,29", nl: "143452-10,29",
  jp: "143462-9,29", kr: "143466-13,29",
  cn: "143465-19,29", tw: "143470-18,29", hk: "143463-45,29",
  ru: "143469-16,29", tr: "143480-25,29",
  se: "143456-17,29", no: "143457-14,29", dk: "143458-11,29", fi: "143447-12,29",
  pl: "143478-39,29", in: "143467-50,29", sg: "143464-48,29",
  nz: "143461-27,29", za: "143472-27,29", ie: "143449-2,29",
  th: "143475-35,29", id: "143476-37,29",
};

// ─── App Store Scraper Service ──────────────────────────────────────────

export class AppStoreScraper {
  private readonly baseUrl = "https://itunes.apple.com";
  private readonly country: string;
  private readonly language: string;
  private readonly bundleId: string;

  constructor(countryOrSettings?: string | EffectiveSettings, language?: string) {
    if (countryOrSettings && typeof countryOrSettings === "object") {
      this.country = countryOrSettings.scrapeCountry || env.SCRAPE_COUNTRY;
      this.bundleId = countryOrSettings.ascBundleId || env.ASC_BUNDLE_ID;
    } else {
      this.country = countryOrSettings ?? env.SCRAPE_COUNTRY;
      this.bundleId = env.ASC_BUNDLE_ID;
    }
    this.language = language ?? langForCountry(this.country);
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
   * Get Apple search suggestions (auto-complete) for a term.
   * The position in the suggestion list correlates with search popularity.
   * Returns suggestion terms ordered by relevance/popularity.
   */
  async getSearchSuggestions(term: string): Promise<string[]> {
    const storeFront = STOREFRONT[this.country.toLowerCase()] ?? STOREFRONT.us;
    const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints`;
    try {
      const { data: xml } = await axios.get<string>(url, {
        params: { term, media: "software" },
        headers: {
          "X-Apple-Store-Front": storeFront,
          "User-Agent": "iTunes/12.0",
        },
        timeout: 5000,
      });

      // Parse Apple's plist XML response
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const dict = parsed?.plist?.dict;
      if (!dict) return [];

      // hints can be an array of dicts or a single dict
      const hintsKey = Array.isArray(dict.key) ? dict.key : [dict.key];
      const hintsVal = Array.isArray(dict.array?.dict)
        ? dict.array.dict
        : dict.array?.dict
          ? [dict.array.dict]
          : [];

      // Each hint is {key: ['term','url'], string: ['suggestion text', 'url']}
      return hintsVal
        .map((h: any) => {
          const strings = Array.isArray(h.string) ? h.string : [h.string];
          return strings[0]; // first string is the term
        })
        .filter(Boolean);
    } catch (error) {
      logger.debug(`Search suggestions for "${term}" failed: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Calculate keyword metrics from Apple data:
   *  - popularity:   Based on search suggestion ranking (higher = appears earlier in Apple autocomplete)
   *  - difficulty:    Based on top-10 competitor strength (ratings count)
   *  - searchVolume:  Based on number of search results returned
   *
   * @param term  Keyword to analyze
   * @param limit Number of search results to fetch (more = slower but more accurate)
   */
  async analyzeKeyword(term: string, limit = 50): Promise<{
    results: ITunesResult[];
    popularity: number;
    difficulty: number;
    searchVolume: number;
  }> {
    // ── 1. Fetch search results ──────────────────────────────────────
    const results = await this.searchApps(term, limit);
    const resultCount = results.length;

    // ── 2. Compute market signals ───────────────────────────────────
    const totalRatings = results.reduce((sum, r) => sum + (r.userRatingCount ?? 0), 0);
    const avgRatingCount = resultCount > 0 ? totalRatings / resultCount : 0;

    const top10 = results.slice(0, 10);
    const top10AvgRatings = top10.length > 0
      ? top10.reduce((sum, r) => sum + (r.userRatingCount ?? 0), 0) / top10.length
      : 0;
    const top10MaxRatings = top10.length > 0
      ? Math.max(...top10.map(r => r.userRatingCount ?? 0))
      : 0;

    // ── 3. Popularity: blended score from autocomplete + market strength ─
    //
    // Autocomplete position alone is misleading — niche brand names appear
    // at position 0 even if nobody searches for them. We combine:
    //   - autocompleteScore (0-50): position in Apple's suggestion list
    //   - marketScore (0-50): how competitive the search results are
    //
    // A keyword is truly popular only if it has BOTH autocomplete presence
    // AND competitive results.

    const suggestions = await this.getSearchSuggestions(term);
    const termLower = term.toLowerCase();
    const exactIndex = suggestions.findIndex(s => s.toLowerCase() === termLower);
    const partialIndex = suggestions.findIndex(s =>
      s.toLowerCase().includes(termLower) || termLower.includes(s.toLowerCase())
    );

    // Autocomplete score (0–50)
    let autocompleteScore: number;
    if (exactIndex >= 0) {
      autocompleteScore = Math.max(10, Math.round(50 - exactIndex * 5));
    } else if (partialIndex >= 0) {
      autocompleteScore = Math.max(5, Math.round(35 - partialIndex * 4));
    } else if (suggestions.length > 0) {
      autocompleteScore = 5; // prefix exists but term not suggested
    } else {
      autocompleteScore = 0; // no suggestions at all
    }

    // Market score (0–50): based on how many competing apps exist and how strong they are
    let marketScore: number;
    if (resultCount >= 40 && avgRatingCount > 100000) {
      marketScore = 50; // saturated market = very popular keyword
    } else if (resultCount >= 30 && avgRatingCount > 10000) {
      marketScore = 40;
    } else if (resultCount >= 20 && avgRatingCount > 1000) {
      marketScore = 30;
    } else if (resultCount >= 10) {
      marketScore = Math.round(10 + Math.min(Math.log10(avgRatingCount + 1) * 4, 15));
    } else if (resultCount >= 3) {
      marketScore = Math.round(5 + Math.min(Math.log10(avgRatingCount + 1) * 3, 10));
    } else {
      // Very few results → niche / brand term → low market score
      marketScore = Math.min(5, resultCount * 2);
    }

    const popularity = Math.min(100, Math.max(1, autocompleteScore + marketScore));

    // ── 4. Difficulty: based on top-10 competitor strength ───────────
    let difficulty: number;
    if (top10MaxRatings > 1000000) {
      difficulty = Math.min(100, 85 + Math.round(Math.log10(top10AvgRatings) * 3));
    } else if (top10AvgRatings > 100000) {
      difficulty = Math.round(70 + (Math.log10(top10AvgRatings / 100000)) * 20);
    } else if (top10AvgRatings > 10000) {
      difficulty = Math.round(40 + (top10AvgRatings / 100000) * 30);
    } else if (top10AvgRatings > 1000) {
      difficulty = Math.round(20 + (top10AvgRatings / 10000) * 20);
    } else {
      difficulty = Math.max(1, Math.round((top10AvgRatings / 1000) * 20));
    }
    difficulty = Math.min(100, Math.max(0, difficulty));

    // ── 5. Search volume: result count as proxy ─────────────────────
    const searchVolume = resultCount;

    logger.debug(
      `Keyword "${term}": popularity=${popularity} (ac=${autocompleteScore} mkt=${marketScore} pos=${exactIndex}), ` +
      `difficulty=${difficulty} (top10avg=${Math.round(top10AvgRatings)}), volume=${searchVolume}`
    );

    return { results, popularity, difficulty, searchVolume };
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
      await this.scrapeAndSaveApp(this.bundleId, true);

      // Scrape all tracked competitors
      const ownApp = await prisma.app.findUnique({
        where: { bundleId: this.bundleId },
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
