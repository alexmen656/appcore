import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma, env, logger } from "../config";
import type { EffectiveSettings } from "../config";
import { SuggestionType, SuggestionStatus } from "@prisma/client";

// ─── Locale Configuration ───────────────────────────────────────────────

interface LocaleConfig {
  locale: string; // ASC locale, e.g. "en-US"
  language: string; // human-readable
  promptLang: string; // language for the AI prompt output
  market: string; // market description for the prompt
}

const LOCALE_MAP: Record<string, LocaleConfig> = {
  "en-US": {
    locale: "en-US",
    language: "English",
    promptLang: "English",
    market: "US/English-speaking",
  },
  "en-GB": {
    locale: "en-GB",
    language: "English (UK)",
    promptLang: "English",
    market: "UK",
  },
  "en-AU": {
    locale: "en-AU",
    language: "English (AU)",
    promptLang: "English",
    market: "Australian",
  },
  "de-DE": {
    locale: "de-DE",
    language: "Deutsch",
    promptLang: "German",
    market: "German",
  },
  "fr-FR": {
    locale: "fr-FR",
    language: "Français",
    promptLang: "French",
    market: "French",
  },
  "es-ES": {
    locale: "es-ES",
    language: "Español",
    promptLang: "Spanish",
    market: "Spanish",
  },
  "es-MX": {
    locale: "es-MX",
    language: "Español (MX)",
    promptLang: "Spanish",
    market: "Latin American",
  },
  "it-IT": {
    locale: "it-IT",
    language: "Italiano",
    promptLang: "Italian",
    market: "Italian",
  },
  "pt-BR": {
    locale: "pt-BR",
    language: "Português (BR)",
    promptLang: "Portuguese",
    market: "Brazilian",
  },
  "pt-PT": {
    locale: "pt-PT",
    language: "Português",
    promptLang: "Portuguese",
    market: "Portuguese",
  },
  "nl-NL": {
    locale: "nl-NL",
    language: "Nederlands",
    promptLang: "Dutch",
    market: "Dutch",
  },
  ja: {
    locale: "ja",
    language: "日本語",
    promptLang: "Japanese",
    market: "Japanese",
  },
  ko: {
    locale: "ko",
    language: "한국어",
    promptLang: "Korean",
    market: "Korean",
  },
  "zh-Hans": {
    locale: "zh-Hans",
    language: "中文(简体)",
    promptLang: "Simplified Chinese",
    market: "Chinese",
  },
  "zh-Hant": {
    locale: "zh-Hant",
    language: "中文(繁體)",
    promptLang: "Traditional Chinese",
    market: "Taiwanese/Hong Kong",
  },
  ru: {
    locale: "ru",
    language: "Русский",
    promptLang: "Russian",
    market: "Russian",
  },
  tr: {
    locale: "tr",
    language: "Türkçe",
    promptLang: "Turkish",
    market: "Turkish",
  },
  "ar-SA": {
    locale: "ar-SA",
    language: "العربية",
    promptLang: "Arabic",
    market: "Arabic-speaking",
  },
  th: { locale: "th", language: "ไทย", promptLang: "Thai", market: "Thai" },
  sv: {
    locale: "sv",
    language: "Svenska",
    promptLang: "Swedish",
    market: "Swedish",
  },
  da: {
    locale: "da",
    language: "Dansk",
    promptLang: "Danish",
    market: "Danish",
  },
  fi: {
    locale: "fi",
    language: "Suomi",
    promptLang: "Finnish",
    market: "Finnish",
  },
  nb: {
    locale: "nb",
    language: "Norsk",
    promptLang: "Norwegian",
    market: "Norwegian",
  },
  pl: {
    locale: "pl",
    language: "Polski",
    promptLang: "Polish",
    market: "Polish",
  },
  cs: {
    locale: "cs",
    language: "Čeština",
    promptLang: "Czech",
    market: "Czech",
  },
  el: {
    locale: "el",
    language: "Ελληνικά",
    promptLang: "Greek",
    market: "Greek",
  },
  he: {
    locale: "he",
    language: "עברית",
    promptLang: "Hebrew",
    market: "Israeli",
  },
  id: {
    locale: "id",
    language: "Bahasa Indonesia",
    promptLang: "Indonesian",
    market: "Indonesian",
  },
  ms: {
    locale: "ms",
    language: "Bahasa Melayu",
    promptLang: "Malay",
    market: "Malaysian",
  },
  vi: {
    locale: "vi",
    language: "Tiếng Việt",
    promptLang: "Vietnamese",
    market: "Vietnamese",
  },
  uk: {
    locale: "uk",
    language: "Українська",
    promptLang: "Ukrainian",
    market: "Ukrainian",
  },
  ro: {
    locale: "ro",
    language: "Română",
    promptLang: "Romanian",
    market: "Romanian",
  },
  hu: {
    locale: "hu",
    language: "Magyar",
    promptLang: "Hungarian",
    market: "Hungarian",
  },
  sk: {
    locale: "sk",
    language: "Slovenčina",
    promptLang: "Slovak",
    market: "Slovak",
  },
  hr: {
    locale: "hr",
    language: "Hrvatski",
    promptLang: "Croatian",
    market: "Croatian",
  },
  ca: {
    locale: "ca",
    language: "Català",
    promptLang: "Catalan",
    market: "Catalan",
  },
  hi: {
    locale: "hi",
    language: "हिन्दी",
    promptLang: "Hindi",
    market: "Indian",
  },
};

function getLocaleConfig(locale: string): LocaleConfig {
  return (
    LOCALE_MAP[locale] ?? {
      locale,
      language: locale,
      promptLang: "English",
      market: locale,
    }
  );
}

/** Parse ASO_LOCALES env var into locale list (fallback when no settings provided) */
function getConfiguredLocales(): string[] {
  return env.ASO_LOCALES.split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ─── AI Provider Abstraction ────────────────────────────────────────────

interface AIResponse {
  content: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

interface ASOAnalysis {
  titleSuggestions: Array<{
    value: string;
    reasoning: string;
    confidence: number;
  }>;
  subtitleSuggestions: Array<{
    value: string;
    reasoning: string;
    confidence: number;
  }>;
  keywordSuggestions: Array<{
    value: string;
    reasoning: string;
    confidence: number;
  }>;
  descriptionSuggestions: Array<{
    value: string;
    reasoning: string;
    confidence: number;
  }>;
  competitorInsights: string;
  overallStrategy: string;
}

export class AIAnalyzer {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private readonly settings?: EffectiveSettings;

  constructor(settings?: EffectiveSettings) {
    this.settings = settings;

    const openaiKey = settings?.openaiApiKey || env.OPENAI_API_KEY;
    const anthropicKey = settings?.anthropicApiKey || env.ANTHROPIC_API_KEY;

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }

    if (!this.openai && !this.anthropic) {
      logger.warn(
        "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in settings.",
      );
    }
  }

  private async query(
    systemPrompt: string,
    userPrompt: string,
    provider?: "openai" | "anthropic",
  ): Promise<AIResponse> {
    const selectedProvider =
      provider ??
      (this.settings?.aiProvider as "openai" | "anthropic" | undefined) ??
      env.AI_PROVIDER;

    if (selectedProvider === "anthropic" && this.anthropic) {
      return this.queryAnthropic(systemPrompt, userPrompt);
    }
    if (this.openai) {
      return this.queryOpenAI(systemPrompt, userPrompt);
    }
    throw new Error("No AI provider available");
  }

  private async queryOpenAI(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIResponse> {
    const response = await this.openai!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      provider: "openai",
      model: "gpt-4o",
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    };
  }

  private async queryAnthropic(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIResponse> {
    const response = await this.anthropic!.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((c) => c.type === "text");

    return {
      content: textBlock?.text ?? "",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      promptTokens: response.usage?.input_tokens,
      completionTokens: response.usage?.output_tokens,
    };
  }

  // ─── ASO Analysis ─────────────────────────────────────────────────

  async analyzeAndSuggest(
    locales?: string[],
  ): Promise<Map<string, ASOAnalysis>> {
    const targetLocales =
      locales ?? this.settings?.asoLocales ?? getConfiguredLocales();
    const results = new Map<string, ASOAnalysis>();
    const appData = await this.gatherAppData();

    for (const locale of targetLocales) {
      logger.info(`Running AI ASO analysis for locale: ${locale}`);
      try {
        const analysis = await this.analyzeForLocale(locale, appData);
        results.set(locale, analysis);
      } catch (error) {
        logger.error(`AI analysis failed for locale ${locale}`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return results;
  }

  private async gatherAppData() {
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: this.settings?.ascBundleId || env.ASC_BUNDLE_ID },
      include: {
        snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
        competitors: {
          include: {
            competitor: {
              include: {
                snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
              },
            },
          },
        },
        rankings: {
          orderBy: { trackedAt: "desc" },
          take: 50,
          include: { keyword: true },
        },
      },
    });

    if (!ownApp) {
      throw new Error("Own app not found. Run scrape first.");
    }

    return ownApp;
  }

  private async analyzeForLocale(
    locale: string,
    ownApp: Awaited<ReturnType<typeof this.gatherAppData>>,
  ): Promise<ASOAnalysis> {
    const lc = getLocaleConfig(locale);
    const ownSnapshot = ownApp.snapshots[0];

    const competitorData = ownApp.competitors.map((rel) => ({
      name: rel.competitor.name,
      title: rel.competitor.currentTitle,
      subtitle: rel.competitor.currentSubtitle,
      description: rel.competitor.snapshots[0]?.description?.substring(0, 500),
      rating: rel.competitor.snapshots[0]?.rating,
      ratingsCount: rel.competitor.snapshots[0]?.ratingsCount,
    }));

    const keywordData = ownApp.rankings.map((r) => ({
      keyword: r.keyword.term,
      rank: r.rank,
      popularity: r.keyword.popularity,
    }));

    const systemPrompt = `You are an expert App Store Optimization (ASO) specialist.
You analyze app metadata, competitor apps, and keyword rankings to generate
data-driven optimization suggestions.

TARGET LOCALE: ${locale} (${lc.language})
TARGET MARKET: ${lc.market} market

CRITICAL RULES:
- App title: max 30 characters
- Subtitle: max 30 characters
- Keywords: max 100 characters, comma-separated, NO spaces after commas
- Description: max 4000 characters, first 3 lines are most important
- ALL suggestions (title, subtitle, keywords, description) MUST be written in ${lc.promptLang}
- Use keywords natural in title and subtitle
- Analyze what works for competitors
- Optimize specifically for the ${lc.market} market and ${lc.promptLang}-speaking users
- Consider cultural nuances and local search behavior

ALWAYS respond as valid JSON in this format:
{
  "titleSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "subtitleSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "keywordSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "descriptionSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "competitorInsights": "...",
  "overallStrategy": "..."
}

Write ALL suggestion values in ${lc.promptLang}. Reasoning can be in English.`;

    const userPrompt = `Analyze this app and generate ASO suggestions for ${lc.language} (${locale}):

## OUR APP
Name: ${ownApp.name}
Bundle ID: ${ownApp.bundleId}
Current Title: ${ownApp.currentTitle}
Current Subtitle: ${ownApp.currentSubtitle ?? "none"}
Current Keywords: ${ownApp.currentKeywords ?? "not available"}
Current Description (excerpt): ${ownSnapshot?.description?.substring(0, 800) ?? "not available"}
Rating: ${ownSnapshot?.rating ?? "?"} (${ownSnapshot?.ratingsCount ?? "?"} ratings)

## KEYWORD RANKINGS
${
  keywordData.length > 0
    ? keywordData
        .map(
          (k) =>
            `- "${k.keyword}": Rank ${k.rank ?? "unranked"} (Popularity: ${k.popularity ?? "?"})`,
        )
        .join("\n")
    : "No keywords tracked yet"
}

## COMPETITOR APPS (${competitorData.length} apps)
${competitorData
  .map(
    (c) => `### ${c.name}
Title: ${c.title}
Subtitle: ${c.subtitle ?? "-"}
Description (excerpt): ${c.description ?? "-"}
Rating: ${c.rating ?? "?"} (${c.ratingsCount ?? "?"} ratings)`,
  )
  .join("\n\n")}

Generate detailed ASO optimization suggestions in ${lc.promptLang} for the ${lc.market} market.`;

    const response = await this.query(systemPrompt, userPrompt);

    let analysis: ASOAnalysis;
    try {
      let jsonStr = response.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      analysis = JSON.parse(jsonStr);
    } catch (error) {
      logger.error(`Failed to parse AI response as JSON for locale ${locale}`, {
        content: response.content.substring(0, 200),
      });
      throw new Error("AI response was not valid JSON");
    }

    await this.saveSuggestions(analysis, response, locale);

    logger.info(`ASO analysis complete for ${locale}`, {
      titles: analysis.titleSuggestions.length,
      subtitles: analysis.subtitleSuggestions.length,
      keywords: analysis.keywordSuggestions.length,
      descriptions: analysis.descriptionSuggestions.length,
    });

    return analysis;
  }

  private async saveSuggestions(
    analysis: ASOAnalysis,
    aiResponse: AIResponse,
    locale: string,
  ): Promise<void> {
    const suggestions = [
      ...analysis.titleSuggestions.map((s) => ({
        type: SuggestionType.TITLE as SuggestionType,
        ...s,
      })),
      ...analysis.subtitleSuggestions.map((s) => ({
        type: SuggestionType.SUBTITLE as SuggestionType,
        ...s,
      })),
      ...analysis.keywordSuggestions.map((s) => ({
        type: SuggestionType.KEYWORDS as SuggestionType,
        ...s,
      })),
      ...analysis.descriptionSuggestions.map((s) => ({
        type: SuggestionType.DESCRIPTION as SuggestionType,
        ...s,
      })),
    ];

    for (const suggestion of suggestions) {
      await prisma.aSOSuggestion.create({
        data: {
          type: suggestion.type,
          locale,
          suggestedValue: suggestion.value,
          reasoning: suggestion.reasoning,
          confidenceScore: suggestion.confidence,
          status: SuggestionStatus.PENDING,
          aiProvider: aiResponse.provider,
          aiModel: aiResponse.model,
          promptTokens: aiResponse.promptTokens,
          completionTokens: aiResponse.completionTokens,
        },
      });
    }

    logger.info(
      `Saved ${suggestions.length} ASO suggestions for locale ${locale}`,
    );
  }

  // ─── Keyword Extraction ───────────────────────────────────────────

  async extractKeywordsFromCompetitors(): Promise<
    Array<{ keyword: string; frequency: number; relevance: number }>
  > {
    const competitors = await prisma.app.findMany({
      where: { isOwnApp: false },
      include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
    });

    const descriptions = competitors
      .map((c) => ({
        name: c.name,
        title: c.currentTitle ?? "",
        subtitle: c.currentSubtitle ?? "",
        description: c.snapshots[0]?.description?.substring(0, 500) ?? "",
      }))
      .filter((c) => c.description.length > 0);

    if (descriptions.length === 0) {
      logger.warn("No competitor data available for keyword extraction");
      return [];
    }

    const systemPrompt = `Du bist ein ASO-Keyword-Analyst. Extrahiere die wichtigsten Keywords 
aus den Konkurrenz-App-Beschreibungen. Fokus auf den deutschen Markt.

Antworte als JSON:
{
  "keywords": [
    {"keyword": "...", "frequency": 1-10, "relevance": 0.0-1.0}
  ]
}`;

    const userPrompt = `Analysiere diese Konkurrenz-Apps und extrahiere die wichtigsten ASO-Keywords:

${descriptions
  .map(
    (d) => `## ${d.name}
Titel: ${d.title}
Untertitel: ${d.subtitle}
Beschreibung: ${d.description}`,
  )
  .join("\n\n")}

Extrahiere die 30 wichtigsten Keywords/Suchbegriffe die Nutzer verwenden würden.`;

    const response = await this.query(systemPrompt, userPrompt);

    try {
      let jsonStr = response.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      const parsed = JSON.parse(jsonStr);
      return parsed.keywords ?? [];
    } catch {
      logger.error("Failed to parse keyword extraction response");
      return [];
    }
  }
}
