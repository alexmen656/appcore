import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma, env, logger } from "../config";
import { SuggestionType, SuggestionStatus } from "@prisma/client";

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

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    if (env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }

    if (!this.openai && !this.anthropic) {
      logger.warn(
        "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY."
      );
    }
  }

  /**
   * Send a prompt to the configured AI provider
   */
  private async query(
    systemPrompt: string,
    userPrompt: string,
    provider?: "openai" | "anthropic"
  ): Promise<AIResponse> {
    const selectedProvider = provider ?? env.AI_PROVIDER;

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
    userPrompt: string
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
    userPrompt: string
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

  /**
   * Analyze our app vs competitors and generate ASO suggestions
   */
  async analyzeAndSuggest(): Promise<ASOAnalysis> {
    // Gather data
    const ownApp = await prisma.app.findUnique({
      where: { bundleId: env.ASC_BUNDLE_ID },
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

    // Build the analysis prompt
    const systemPrompt = `Du bist ein erfahrener App Store Optimization (ASO) Experte. 
Du analysierst App-Metadaten, Konkurrenz-Apps und Keyword-Rankings, um datenbasierte 
Optimierungsvorschläge zu generieren.

WICHTIGE REGELN:
- App-Titel: max 30 Zeichen
- Untertitel: max 30 Zeichen  
- Keywords: max 100 Zeichen, komma-separiert, keine Leerzeichen nach Kommas
- Beschreibung: max 4000 Zeichen, die ersten 3 Zeilen sind am wichtigsten
- Nutze relevante Keywords natürlich in Titel und Untertitel
- Analysiere was bei der Konkurrenz funktioniert
- Berücksichtige den deutschen Markt

Antworte IMMER als valides JSON im folgenden Format:
{
  "titleSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "subtitleSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "keywordSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "descriptionSuggestions": [{"value": "...", "reasoning": "...", "confidence": 0.0-1.0}],
  "competitorInsights": "...",
  "overallStrategy": "..."
}`;

    const userPrompt = `Analysiere die folgende App und ihre Konkurrenz:

## UNSERE APP
Name: ${ownApp.name}
Bundle ID: ${ownApp.bundleId}
Aktueller Titel: ${ownApp.currentTitle}
Aktueller Untertitel: ${ownApp.currentSubtitle ?? "keiner"}
Aktuelle Keywords: ${ownApp.currentKeywords ?? "nicht verfügbar"}
Aktuelle Beschreibung (Auszug): ${ownSnapshot?.description?.substring(0, 800) ?? "nicht verfügbar"}
Rating: ${ownSnapshot?.rating ?? "?"} (${ownSnapshot?.ratingsCount ?? "?"} Bewertungen)

## KEYWORD-RANKINGS
${keywordData.length > 0
        ? keywordData.map((k) => `- "${k.keyword}": Rang ${k.rank ?? "nicht gerankt"} (Popularität: ${k.popularity ?? "?"})`).join("\n")
        : "Noch keine Keywords getrackt"
      }

## KONKURRENZ-APPS (${competitorData.length} Apps)
${competitorData
        .map(
          (c) => `### ${c.name}
Titel: ${c.title}
Untertitel: ${c.subtitle ?? "-"}
Beschreibung (Auszug): ${c.description ?? "-"}
Rating: ${c.rating ?? "?"} (${c.ratingsCount ?? "?"} Bewertungen)`
        )
        .join("\n\n")}

Erstelle detaillierte ASO-Optimierungsvorschläge basierend auf dieser Analyse.`;

    logger.info("Running AI ASO analysis...");
    const response = await this.query(systemPrompt, userPrompt);

    let analysis: ASOAnalysis;
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      analysis = JSON.parse(jsonStr);
    } catch (error) {
      logger.error("Failed to parse AI response as JSON", {
        content: response.content.substring(0, 200),
      });
      throw new Error("AI response was not valid JSON");
    }

    // Save suggestions to database
    await this.saveSuggestions(analysis, response);

    logger.info("ASO analysis complete", {
      titles: analysis.titleSuggestions.length,
      subtitles: analysis.subtitleSuggestions.length,
      keywords: analysis.keywordSuggestions.length,
      descriptions: analysis.descriptionSuggestions.length,
    });

    return analysis;
  }

  /**
   * Persist AI suggestions in the database
   */
  private async saveSuggestions(
    analysis: ASOAnalysis,
    aiResponse: AIResponse
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

    logger.info(`Saved ${suggestions.length} ASO suggestions`);
  }

  // ─── Keyword Extraction ───────────────────────────────────────────

  /**
   * Extract potential keywords from competitor descriptions
   */
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
Beschreibung: ${d.description}`
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
