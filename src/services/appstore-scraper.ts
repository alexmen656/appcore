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
  us: "en",
  gb: "en",
  au: "en",
  ca: "en",
  nz: "en",
  ie: "en",
  za: "en",
  sg: "en",
  in: "en",
  de: "de",
  at: "de",
  ch: "de",
  fr: "fr",
  be: "fr",
  es: "es",
  mx: "es",
  ar: "es",
  cl: "es",
  co: "es",
  pt: "pt",
  br: "pt",
  it: "it",
  nl: "nl",
  ja: "ja",
  jp: "ja",
  ko: "ko",
  kr: "ko",
  zh: "zh",
  cn: "zh",
  tw: "zh",
  hk: "zh",
  ru: "ru",
  tr: "tr",
  pl: "pl",
  sv: "sv",
  se: "sv",
  no: "no",
  da: "da",
  dk: "da",
  fi: "fi",
  th: "th",
  id: "id",
  vi: "vi",
  vn: "vi",
  ms: "ms",
  my: "ms",
  el: "el",
  gr: "el",
  he: "he",
  il: "he",
  sa: "ar",
  ae: "ar",
  eg: "ar",
  hi: "hi",
  uk: "uk",
  ua: "uk",
  cs: "cs",
  cz: "cs",
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
const STOREFRONT: Record<string, string> = {
  us: "143441-1,29",
  gb: "143444-2,29",
  au: "143460-27,29",
  ca: "143455-6,29",
  de: "143443-4,29",
  at: "143445-4,29",
  ch: "143459-4,29",
  fr: "143442-3,29",
  be: "143446-3,29",
  es: "143454-8,29",
  mx: "143468-28,29",
  pt: "143453-24,29",
  br: "143503-15,29",
  it: "143450-7,29",
  nl: "143452-10,29",
  jp: "143462-9,29",
  kr: "143466-13,29",
  cn: "143465-19,29",
  tw: "143470-18,29",
  hk: "143463-45,29",
  ru: "143469-16,29",
  tr: "143480-25,29",
  se: "143456-17,29",
  no: "143457-14,29",
  dk: "143458-11,29",
  fi: "143447-12,29",
  pl: "143478-39,29",
  in: "143467-50,29",
  sg: "143464-48,29",
  nz: "143461-27,29",
  za: "143472-27,29",
  ie: "143449-2,29",
  th: "143475-35,29",
  id: "143476-37,29",
};

// ─── App Store Scraper Service ──────────────────────────────────────────

export class AppStoreScraper {
  private readonly baseUrl = "https://itunes.apple.com";
  private readonly country: string;
  private readonly language: string;
  private readonly bundleId: string;

  constructor(
    countryOrSettings?: string | EffectiveSettings,
    language?: string,
  ) {
    if (countryOrSettings && typeof countryOrSettings === "object") {
      this.country = countryOrSettings.scrapeCountry;
      this.bundleId = countryOrSettings.ascBundleId;
    } else {
      console.log(`[AppStoreScraper] No settings provided.`);
      this.country = "";
      this.bundleId = "";
    }

    this.language = language ?? langForCountry(this.country);
  }

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

      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const dict = parsed?.plist?.dict;
      if (!dict) return [];

      const hintsKey = Array.isArray(dict.key) ? dict.key : [dict.key];
      const hintsVal = Array.isArray(dict.array?.dict)
        ? dict.array.dict
        : dict.array?.dict
          ? [dict.array.dict]
          : [];

      return hintsVal
        .map((h: any) => {
          const strings = Array.isArray(h.string) ? h.string : [h.string];
          return strings[0];
        })
        .filter(Boolean);
    } catch (error) {
      logger.debug(
        `Search suggestions for "${term}" failed: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  async analyzeKeyword(
    term: string,
    limit = 50,
  ): Promise<{
    results: ITunesResult[];
    popularity: number;
    difficulty: number;
    searchVolume: number;
  }> {
    // ── 1. Fetch results and autocomplete suggestions in parallel ────
    const [results, suggestions] = await Promise.all([
      this.searchApps(term, limit),
      this.getSearchSuggestions(term),
    ]);
    const resultCount = results.length;
    const termLower = term.toLowerCase();

    // ── 2. Autocomplete score (0–30) ─────────────────────────────────
    //
    // Apple's suggestion list position is the strongest externally-available
    // proxy for real user search volume. We distinguish three match types:
    //   exact   – term appears verbatim in suggestions  (strongest signal)
    //   prefix  – a suggestion *starts with* our term   (e.g. "fit" → "fitness tracker")
    //   contains – term appears somewhere inside a suggestion
    //
    // Suggestion count adds a small richness bonus: Apple only returns
    // completions for queries with meaningful search activity, so more
    // completions = busier query space.

    const exactIndex = suggestions.findIndex(
      (s) => s.toLowerCase() === termLower,
    );
    const prefixIndex = suggestions.findIndex((s) =>
      s.toLowerCase().startsWith(termLower),
    );
    const containsIndex = suggestions.findIndex((s) =>
      s.toLowerCase().includes(termLower),
    );

    let positionScore: number;
    if (exactIndex === 0) {
      positionScore = 25;
    } else if (exactIndex === 1) {
      positionScore = 22;
    } else if (exactIndex === 2) {
      positionScore = 19;
    } else if (exactIndex >= 3) {
      positionScore = Math.max(8, 16 - exactIndex * 2);
    } else if (prefixIndex === 0) {
      positionScore = 14;
    } else if (prefixIndex >= 1) {
      positionScore = Math.max(6, 12 - prefixIndex * 2);
    } else if (containsIndex >= 0) {
      positionScore = Math.max(2, Math.round(8 - containsIndex * 1.5));
    } else if (suggestions.length > 0) {
      // Apple returns completions but none relate to our term → low but non-zero
      positionScore = 2;
    } else {
      positionScore = 0;
    }

    // Richness bonus (0–5): more completions returned = busier query space
    const suggestionBonus = Math.min(5, Math.ceil(suggestions.length / 2));
    const autocompleteScore = Math.min(
      30,
      Math.round(positionScore + suggestionBonus),
    );

    // ── 3. Market depth score (0–25): result saturation ──────────────
    //
    // Logistic curve via 1 − e^(−x/15) — grows quickly at first then
    // saturates near 50 results. No hard tier thresholds, no cliffs.
    const depthScore =
      resultCount === 0
        ? 0
        : Math.round(25 * (1 - Math.exp(-resultCount / 15)));

    // ── 4. Engagement score (0–30): position-weighted rating counts ───
    //
    // Higher-ranked apps are more indicative of keyword demand; later
    // positions get exponential decay. Log-scaled so the range doesn't
    // collapse for ultra-popular keywords vs niche ones.
    //   weighted ≈ 100  → score ≈ 10
    //   weighted ≈ 10K  → score ≈ 20
    //   weighted ≈ 1M   → score = 30 (cap)
    const weightedRatings = results
      .slice(0, 20)
      .reduce((sum, r, i) => sum + (r.userRatingCount ?? 0) / (1 + i * 0.3), 0);
    const engagementScore =
      weightedRatings > 0
        ? Math.min(30, Math.round(Math.log10(weightedRatings + 1) * 5))
        : 0;

    // ── 5. Market quality score (0–15): breadth of established apps ───
    //
    // Counts how many of the top-10 results have ≥500 ratings.
    // A keyword where 8 of the top 10 apps are well-established is a
    // genuinely more active search space than one with a single hit app.
    const qualifiedApps = results
      .slice(0, 10)
      .filter((r) => (r.userRatingCount ?? 0) >= 500).length;
    const qualityScore = Math.min(15, Math.round(qualifiedApps * 1.5));

    // ── 6. Brand-term detection & penalty ─────────────────────────────
    //
    // Brand searches (e.g. "whatsapp", "spotify") show: very few diverse
    // results, first app name closely matches the query. They reflect high
    // search volume but zero targetability as generic keywords. We use
    // character-bigram (Dice) similarity for a fuzzy name comparison
    // rather than simple startsWith, which misses many brand variants.
    let popularityMultiplier = 1.0;
    if (resultCount <= 4 && results.length > 0) {
      const firstApp = results[0]?.trackName?.toLowerCase() ?? "";
      const firstWord = firstApp.split(/\s+/)[0] ?? "";
      const isBrandLike =
        firstApp === termLower ||
        firstApp.startsWith(termLower) ||
        termLower.startsWith(firstWord) ||
        this.stringSimilarity(termLower, firstApp) > 0.75;
      if (isBrandLike) {
        popularityMultiplier = 0.4;
      }
    }

    // ── 7. Composite popularity (0–100) ──────────────────────────────
    const rawPopularity =
      autocompleteScore + depthScore + engagementScore + qualityScore;
    const popularity = Math.min(
      100,
      Math.max(1, Math.round(rawPopularity * popularityMultiplier)),
    );

    // ── 8. Difficulty: position-weighted competitor strength ──────────
    //
    // Blends top-3 avg (60 %) with top-10 avg (40 %) so the ranking leader
    // matters more than the tail. Formula: (log10(x + 10) − 1) × 20
    // anchors the scale at ratings ≈ 10, yielding:
    //   ~90 ratings → 20   ~990 → 40   ~9 990 → 60   ~99 990 → 80   ~1 M → 100
    const top3 = results.slice(0, 3);
    const top10 = results.slice(0, 10);

    const top3AvgRatings =
      top3.length > 0
        ? top3.reduce((s, r) => s + (r.userRatingCount ?? 0), 0) / top3.length
        : 0;
    const top10AvgRatings =
      top10.length > 0
        ? top10.reduce((s, r) => s + (r.userRatingCount ?? 0), 0) / top10.length
        : 0;
    const top10MaxRatings =
      top10.length > 0
        ? Math.max(...top10.map((r) => r.userRatingCount ?? 0))
        : 0;

    const blendedAvgRatings = top3AvgRatings * 0.6 + top10AvgRatings * 0.4;
    const baseDifficulty = Math.round(
      (Math.log10(blendedAvgRatings + 10) - 1) * 20,
    );

    // Dominance bonus: a single market-leading app raises the entry bar
    // even when the overall top-10 average looks moderate.
    const dominanceBonus =
      top10MaxRatings > 5_000_000
        ? 8
        : top10MaxRatings > 1_000_000
          ? 5
          : top10MaxRatings > 100_000
            ? 2
            : 0;

    const difficulty = Math.min(
      100,
      Math.max(1, baseDifficulty + dominanceBonus),
    );

    // ── 9. Search volume: result count as proxy ───────────────────────
    const searchVolume = resultCount;

    logger.debug(
      `Keyword "${term}": popularity=${popularity} ` +
        `(ac=${autocompleteScore} depth=${depthScore} eng=${engagementScore} qual=${qualityScore} ` +
        `exactIdx=${exactIndex} prefixIdx=${prefixIndex} results=${resultCount} mult=${popularityMultiplier}), ` +
        `difficulty=${difficulty} (blendedAvg=${Math.round(blendedAvgRatings)} domBonus=${dominanceBonus}), ` +
        `volume=${searchVolume}`,
    );

    return { results, popularity, difficulty, searchVolume };
  }

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

      const subtitle =
        $('h2[class*="subtitle"]').text().trim() ||
        $(".app-header__subtitle").text().trim() ||
        undefined;

      const fullDescription =
        $('[data-test-id="description"] .we-truncate__child').text().trim() ||
        $(".section__description .we-truncate__child").text().trim() ||
        undefined;

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

  async scrapeAndSaveApp(
    bundleId: string,
    isOwnApp = false,
  ): Promise<string | null> {
    const itunesData = await this.lookupByBundleId(bundleId);
    if (!itunesData) {
      logger.warn(`App not found: ${bundleId}`);
      return null;
    }

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

    const webData = await this.scrapeAppStorePage(itunesData.trackId);

    if (webData?.subtitle) {
      await prisma.app.update({
        where: { id: app.id },
        data: { currentSubtitle: webData.subtitle },
      });
    }

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

    logger.info(`Scraped and saved: ${itunesData.trackName} (${bundleId})`);
    return app.id;
  }

  async discoverCompetitors(
    searchTerms: string[],
    ownBundleId: string,
    maxResults = 100,
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

      await this.sleep(1000);
    }

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
      `Discovered ${competitorIds.length} competitors for "${ownBundleId}"`,
    );
    return competitorIds;
  }

  async runFullScrapeJob(): Promise<void> {
    const job = await prisma.scrapeJob.create({
      data: {
        type: ScrapeType.COMPETITOR_METADATA,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      await this.scrapeAndSaveApp(this.bundleId, true);

      const ownApp = await prisma.app.findUnique({
        where: { bundleId: this.bundleId },
        include: { competitors: { include: { competitor: true } } },
      });

      let count = 1;
      if (ownApp) {
        for (const rel of ownApp.competitors) {
          await this.scrapeAndSaveApp(rel.competitor.bundleId, false);
          count++;
          await this.sleep(500);
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

  /**
   * Sørensen–Dice similarity over character bigrams (0–1).
   * Used for brand-term detection without a heavy string-similarity library.
   */
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigrams = (s: string): Map<string, number> => {
      const map = new Map<string, number>();
      for (let i = 0; i < s.length - 1; i++) {
        const bg = s.slice(i, i + 2);
        map.set(bg, (map.get(bg) ?? 0) + 1);
      }
      return map;
    };

    const aMap = bigrams(a);
    const bMap = bigrams(b);
    let intersection = 0;
    for (const [bg, count] of aMap) {
      intersection += Math.min(count, bMap.get(bg) ?? 0);
    }
    return (2 * intersection) / (a.length - 1 + b.length - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
