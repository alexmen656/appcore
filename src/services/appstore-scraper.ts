import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { prisma, logger } from "../config";
import {
  normalizeLanguage,
  storefrontHeaderForCountry,
} from "./app-store-markets";

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

export class AppStoreScraper {
  private readonly baseUrl = "https://itunes.apple.com";
  private readonly country: string;
  private readonly language: string;
  private readonly bundleId: string;

  constructor(country: string = "", language?: string, bundleId: string = "") {
    this.country = country;
    this.bundleId = bundleId;
    this.language = normalizeLanguage(language, this.country);
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
    const storeFront = storefrontHeaderForCountry(this.country);
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
    const [results, suggestions] = await Promise.all([
      this.searchApps(term, limit),
      this.getSearchSuggestions(term),
    ]);
    const resultCount = results.length;
    const termLower = term.toLowerCase();

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
      positionScore = 2;
    } else {
      positionScore = 0;
    }

    const suggestionBonus = Math.min(5, Math.ceil(suggestions.length / 2));
    const autocompleteScore = Math.min(
      30,
      Math.round(positionScore + suggestionBonus),
    );

    const depthScore =
      resultCount === 0
        ? 0
        : Math.round(25 * (1 - Math.exp(-resultCount / 15)));

    const weightedRatings = results
      .slice(0, 20)
      .reduce((sum, r, i) => sum + (r.userRatingCount ?? 0) / (1 + i * 0.3), 0);
    const engagementScore =
      weightedRatings > 0
        ? Math.min(30, Math.round(Math.log10(weightedRatings + 1) * 5))
        : 0;

    const qualifiedApps = results
      .slice(0, 10)
      .filter((r) => (r.userRatingCount ?? 0) >= 500).length;
    const qualityScore = Math.min(15, Math.round(qualifiedApps * 1.5));

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

    const rawPopularity =
      autocompleteScore + depthScore + engagementScore + qualityScore;
    const popularity = Math.min(
      100,
      Math.max(1, Math.round(rawPopularity * popularityMultiplier)),
    );

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

  async scrapeVersionHistory(
    trackId: number,
  ): Promise<Array<{ version: string; date: string }>> {
    try {
      const url = `https://apps.apple.com/us/app/id${trackId}`;
      const { data: html } = await axios.get<string>(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const $ = cheerio.load(html);
      const results: Array<{ version: string; date: string }> = [];
      const seen = new Set<string>();

      $("time[datetime]").each((_, el) => {
        const timeEl = $(el);
        const datetime = timeEl.attr("datetime");
        if (!datetime) return;
        const dateStr = datetime.slice(0, 10);
        const prevH4 = timeEl.prev("h4");
        const siblingText = prevH4.length ? prevH4.text().trim() : "";
        const versionFromH4 =
          siblingText.match(/^(?:Version\s+)?([\d]+(?:\.[\d]+)+)$/i)?.[1] ??
          null;

        const container = timeEl.closest(
          "li, .version-history__item, section, [data-test-id]",
        );

        const containerText = (
          container.length ? container : timeEl.parent()
        ).text();

        const versionFromText =
          containerText.match(/Version\s+([\d]+(?:\.[\d]+)*)/i)?.[1] ?? null;

        const version = versionFromH4 ?? versionFromText;
        if (version && dateStr && !seen.has(version)) {
          seen.add(version);
          results.push({ version, date: dateStr });
        }
      });

      return results.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.warn(`Failed to scrape version history for track ${trackId}`, {
        error: error instanceof Error ? error.message : error,
      });
      return [];
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

    const prevSnapshot = await prisma.appSnapshot.findFirst({
      where: { appId: app.id },
      orderBy: { scrapedAt: "desc" },
    });

    if (prevSnapshot) {
      const changes: Array<{
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }> = [];
      const compare = (
        field: string,
        oldVal: string | null | undefined,
        newVal: string | null | undefined,
      ) => {
        const o = oldVal ?? null;
        const n = newVal ?? null;
        if (o !== n)
          changes.push({
            field,
            oldValue: o ? String(o).substring(0, 5000) : null,
            newValue: n ? String(n).substring(0, 5000) : null,
          });
      };

      compare("title", prevSnapshot.title, itunesData.trackName);
      compare("subtitle", prevSnapshot.subtitle, webData?.subtitle);
      compare("description", prevSnapshot.description, itunesData.description);
      compare("version", prevSnapshot.version, itunesData.version);
      compare(
        "releaseNotes",
        prevSnapshot.releaseNotes,
        itunesData.releaseNotes ?? webData?.whatsNew,
      );
      compare(
        "rating",
        prevSnapshot.rating?.toFixed(2),
        itunesData.averageUserRating?.toFixed(2),
      );
      compare(
        "price",
        prevSnapshot.price?.toString(),
        itunesData.price?.toString(),
      );

      if (changes.length > 0) {
        await prisma.appMetadataChange.createMany({
          data: changes.map((c) => ({
            appId: app.id,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })),
        });
        logger.info(
          `Detected ${changes.length} metadata changes for ${bundleId}: ${changes.map((c) => c.field).join(", ")}`,
        );
      }
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

    if (isOwnApp && itunesData.trackId) {
      const history = await this.scrapeVersionHistory(itunesData.trackId);
      if (history.length > 0) {
        const existing = await prisma.appMetadataChange.findMany({
          where: { appId: app.id, field: "version" },
          select: { newValue: true },
        });

        const existingVersions = new Set(existing.map((e) => e.newValue));
        const toCreate = history.filter(
          ({ version }) => !existingVersions.has(version),
        );

        if (toCreate.length > 0) {
          await prisma.appMetadataChange.createMany({
            data: toCreate.map(({ version, date }) => ({
              appId: app.id,
              field: "version",
              oldValue: null,
              newValue: version,
              detectedAt: new Date(date),
            })),
          });
          logger.info(
            `Backfilled ${toCreate.length} version(s) for ${bundleId}: ${toCreate.map((v) => v.version).join(", ")}`,
          );
        }
      }
    }

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
      await Promise.all(
        competitorIds.map((competitorId) =>
          prisma.competitorRelation.upsert({
            where: { appId_competitorId: { appId: ownApp.id, competitorId } },
            create: { appId: ownApp.id, competitorId },
            update: {},
          }),
        ),
      );
    }

    logger.info(
      `Discovered ${competitorIds.length} competitors for "${ownBundleId}"`,
    );
    return competitorIds;
  }

  async runFullScrapeJob(): Promise<void> {
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

      logger.info(`Full scrape job completed: ${count} apps scraped`);
    } catch (error) {
      throw error;
    }
  }

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
