import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma, env, logger } from "../config";
import type { EffectiveSettings } from "../config";
import { ScrapeType, JobStatus } from "@prisma/client";
import { AppStoreScraper } from "./appstore-scraper";

const MIN_POPULARITY = 15;
const MIN_RESULTS = 3;
const MAX_SCORE_PER_RUN = 25;
const MAX_AUTOCOMPLETE_SEEDS = 20;

/**
 * Continuously discovers new relevant keywords to track using three strategies:
 *
 *   1. **Competitor text mining** – AI extracts candidates from competitor
 *      titles, subtitles, keyword fields and description excerpts.
 *
 *   2. **Autocomplete expansion** – feeds each tracked keyword into Apple's
 *      search-hints API and collects suggestions not yet tracked.
 *
 *   3. **Semantic expansion** – AI identifies keyword gaps given the app
 *      description and the current tracked-keyword set (synonyms, long-tail
 *      variants, use-case terms, etc.).
 *
 * Candidates from all three strategies are deduplicated, then scored with the
 * App Store analyzer. Only keywords that meet the minimum popularity and
 * result-count thresholds are added to tracking.
 */

export class KeywordDiscoveryAgent {
  private readonly scraper: AppStoreScraper;
  private readonly country: string;
  private readonly bundleId: string;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private readonly settings?: EffectiveSettings;

  constructor(settings?: EffectiveSettings) {
    this.settings = settings;
    if (settings?.scrapeCountry && settings.ascBundleId) {
      this.country = settings.scrapeCountry;
      this.bundleId = settings.ascBundleId;
    } else {
      logger.warn(
        "[Discovery] No country or bundle ID in settings, discovery will be disabled",
      );
      this.country = "";
      this.bundleId = "";
    }
    this.scraper = new AppStoreScraper(settings ?? this.country);

    const openaiKey = settings?.openaiApiKey;
    const anthropicKey = settings?.anthropicApiKey;
    if (openaiKey) this.openai = new OpenAI({ apiKey: openaiKey });
    if (anthropicKey) this.anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  async run(): Promise<{ discovered: number; scored: number; added: number }> {
    const job = await prisma.scrapeJob.create({
      data: {
        type: ScrapeType.KEYWORD_DISCOVERY,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const result = await this.discover();
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsCount: result.added,
          result: JSON.stringify(result),
        },
      });
      logger.info(
        `[Discovery] Run complete: ${result.discovered} found, ${result.scored} qualified, ${result.added} added`,
      );
      return result;
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

  private async discover(): Promise<{
    discovered: number;
    scored: number;
    added: number;
  }> {
    const existingTerms = await this.loadExistingTerms();
    logger.info(
      `[Discovery] Starting – ${existingTerms.size} keywords already tracked`,
    );

    const [fromCompetitors, fromAutocomplete, fromSemantic] = await Promise.all(
      [
        this.discoverFromCompetitorTexts(existingTerms),
        this.discoverFromAutocompleteExpansion(existingTerms),
        this.discoverFromSemanticExpansion(existingTerms),
      ],
    );

    const candidates = new Set<string>();
    for (const term of [
      ...fromCompetitors,
      ...fromAutocomplete,
      ...fromSemantic,
    ]) {
      const normalized = term.toLowerCase().trim();
      if (normalized.length >= 3 && !existingTerms.has(normalized)) {
        candidates.add(normalized);
      }
    }

    logger.info(
      `[Discovery] ${candidates.size} unique new candidates ` +
        `(competitors=${fromCompetitors.length} autocomplete=${fromAutocomplete.length} semantic=${fromSemantic.length})`,
    );

    const qualified = await this.scoreAndFilter([...candidates]);

    let added = 0;
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: this.bundleId },
    });

    for (const term of qualified) {
      const keyword = await prisma.keyword.upsert({
        where: { term_country: { term, country: this.country } },
        create: { term, country: this.country, language: this.country },
        update: {},
      });

      if (ownApp) {
        const existingRanking = await prisma.keywordRanking.findFirst({
          where: { keywordId: keyword.id, appId: ownApp.id },
        });
        if (!existingRanking) {
          await prisma.keywordRanking.create({
            data: {
              keywordId: keyword.id,
              appId: ownApp.id,
              rank: null,
              country: this.country,
            },
          });
        }
      }

      added++;
    }

    return { discovered: candidates.size, scored: qualified.length, added };
  }

  private async discoverFromCompetitorTexts(
    existing: Set<string>,
  ): Promise<string[]> {
    const ownApp = await prisma.app.findFirst({
      where: { bundleId: this.bundleId, isOwnApp: true },
      include: {
        competitors: {
          include: {
            competitor: {
              include: {
                snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!ownApp) {
      logger.debug("[Discovery:competitors] Own app not found, skipping");
      return [];
    }

    const competitorData = ownApp.competitors
      .map((rel) => {
        const snap = rel.competitor.snapshots[0];
        return {
          name: rel.competitor.name,
          title: rel.competitor.currentTitle ?? rel.competitor.name,
          subtitle: rel.competitor.currentSubtitle,
          keywords: snap?.keywords,
          description: snap?.description?.substring(0, 400),
        };
      })
      .filter((c) => c.description || c.title);

    if (competitorData.length === 0) {
      logger.debug("[Discovery:competitors] No competitor data available");
      return [];
    }

    const systemPrompt = `You are an App Store Optimization (ASO) keyword research expert.
Extract high-value keyword candidates that real users would type in the App Store search bar.

Rules:
- Respond ONLY with valid JSON: {"keywords": ["term1", "term2", ...]}
- Maximum 25 candidates
- All keywords must be in the language for country code: ${this.country}
- Exclude brand names and competitor app names
- Exclude any keyword from the "already tracked" list
- Prefer: use cases, problems solved, feature names, category terms, action+noun combinations`;

    const userPrompt = `App being optimized: "${ownApp.name}" (${this.bundleId})

Already tracked keywords (skip these):
${[...existing].slice(0, 60).join(", ")}

Competitor apps:
${competitorData
  .map(
    (c) =>
      `• ${c.name} | title: "${c.title}" | subtitle: "${c.subtitle ?? ""}" | keywords: "${c.keywords ?? ""}" | desc: "${c.description ?? ""}"`,
  )
  .join("\n")}

Return the 25 most valuable keyword candidates not yet tracked. Respond with JSON only.`;

    try {
      const raw = await this.queryAI(systemPrompt, userPrompt);
      return this.parseKeywordArray(raw, "competitors");
    } catch (error) {
      logger.warn("[Discovery:competitors] AI query failed", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  private async discoverFromAutocompleteExpansion(
    existing: Set<string>,
  ): Promise<string[]> {
    const seeds = [...existing].slice(0, MAX_AUTOCOMPLETE_SEEDS);
    const discovered = new Set<string>();

    for (const seed of seeds) {
      try {
        const suggestions = await this.scraper.getSearchSuggestions(seed);
        for (const suggestion of suggestions) {
          const normalized = suggestion.toLowerCase().trim();
          if (normalized.length >= 3 && !existing.has(normalized)) {
            discovered.add(normalized);
          }
        }
      } catch {
        logger.debug(
          `[Discovery:autocomplete] Suggestion fetch failed for seed "${seed}"`,
        );
      }
      await this.sleep(500);
    }

    logger.debug(
      `[Discovery:autocomplete] ${discovered.size} candidates from ${seeds.length} seeds`,
    );
    return [...discovered];
  }

  private async discoverFromSemanticExpansion(
    existing: Set<string>,
  ): Promise<string[]> {
    const ownApp = await prisma.app.findFirst({
      where: { bundleId: this.bundleId, isOwnApp: true },
      include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
    });

    if (!ownApp) return [];

    const description =
      ownApp.snapshots[0]?.description?.substring(0, 400) ?? "";
    const trackedSample = [...existing].slice(0, 50).join(", ");

    const systemPrompt = `You are an ASO keyword strategy expert.
Identify keyword gaps: search terms users would use that are semantically related
to an app but not yet covered by its tracked keyword set.

Rules:
- Respond ONLY with valid JSON: {"keywords": ["term1", "term2", ...]}
- Maximum 20 candidates
- Language: country code ${this.country}
- No brand names, no duplicates of the tracked list`;

    const userPrompt = `App: "${ownApp.name}"
Description: ${description}

Currently tracked keywords (do NOT repeat):
${trackedSample}

Generate 15–20 keyword gaps. Consider:
- Synonyms and alternative phrasings of existing keywords
- Long-tail variants (e.g. "best X", "X app", "free X", "X for [audience]")
- Problem-based terms ("how to ...", "track my ...")
- Feature-specific terms not yet covered
- Seasonal or trend-adjacent terms

Return JSON only.`;

    try {
      const raw = await this.queryAI(systemPrompt, userPrompt);
      return this.parseKeywordArray(raw, "semantic");
    } catch (error) {
      logger.warn("[Discovery:semantic] AI query failed", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  private async scoreAndFilter(candidates: string[]): Promise<string[]> {
    const toScore = candidates.slice(0, MAX_SCORE_PER_RUN);
    const qualified: string[] = [];

    logger.info(
      `[Discovery] Scoring ${toScore.length} of ${candidates.length} candidates (min pop=${MIN_POPULARITY} min results=${MIN_RESULTS})`,
    );

    for (const candidate of toScore) {
      try {
        const { popularity, searchVolume } = await this.scraper.analyzeKeyword(
          candidate,
          25,
        );

        if (popularity >= MIN_POPULARITY && searchVolume >= MIN_RESULTS) {
          qualified.push(candidate);
          logger.debug(
            `[Discovery] ✓ "${candidate}" accepted (pop=${popularity} results=${searchVolume})`,
          );
        } else {
          logger.debug(
            `[Discovery] ✗ "${candidate}" rejected (pop=${popularity} results=${searchVolume})`,
          );
        }
      } catch {
        logger.debug(`[Discovery] Scoring failed for "${candidate}", skipping`);
      }
      await this.sleep(1500);
    }

    logger.info(
      `[Discovery] ${qualified.length}/${toScore.length} candidates passed scoring`,
    );
    return qualified;
  }

  private async loadExistingTerms(): Promise<Set<string>> {
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: this.bundleId },
    });

    const keywords = await prisma.keyword.findMany({
      where: {
        country: this.country,
        ...(ownApp ? { rankings: { some: { appId: ownApp.id } } } : {}),
      },
      select: { term: true },
    });
    return new Set(keywords.map((k) => k.term.toLowerCase()));
  }

  private async queryAI(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const selectedProvider = this.settings?.aiProvider as
      | "openai"
      | "anthropic"
      | undefined;

    if (selectedProvider === "anthropic" && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = response.content.find((c) => c.type === "text");
      return textBlock?.text ?? "";
    }

    if (this.openai) {
      const response = await this.openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      });
      return response.choices[0]?.message?.content ?? "";
    }

    throw new Error("No AI provider configured");
  }

  private parseKeywordArray(raw: string, source: string): string[] {
    try {
      let jsonStr = raw.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();

      const parsed: unknown = JSON.parse(jsonStr);
      let arr: unknown[];

      if (Array.isArray(parsed)) {
        arr = parsed;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        arr =
          (Array.isArray(obj.keywords) && obj.keywords) ||
          (Array.isArray(obj.results) && obj.results) ||
          (Array.isArray(obj.candidates) && obj.candidates) ||
          [];
      } else {
        arr = [];
      }

      const terms = (arr as unknown[])
        .filter((item): item is string => typeof item === "string")
        .map((s) => s.toLowerCase().trim())
        .filter((s) => s.length >= 3);

      logger.debug(`[Discovery:${source}] Parsed ${terms.length} candidates`);
      return terms;
    } catch {
      logger.warn(`[Discovery:${source}] Failed to parse AI response as JSON`);
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
