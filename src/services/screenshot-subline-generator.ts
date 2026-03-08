import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma, logger } from "../config";

export type ScreenshotSublines = Record<string, Record<string, string>>;

export async function generateScreenshotSublines(
  appId: string,
  descriptions: Record<string, string>,
  detectedLocales: string[],
): Promise<ScreenshotSublines> {
  if (Object.keys(descriptions).length === 0) return {};

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      rankings: {
        orderBy: { rank: "asc" },
        take: 30,
        include: { keyword: true },
      },
    },
  });
  if (!app) throw new Error(`App ${appId} not found`);

  const topKeywords = app.rankings
    .map((r) => ({
      term: r.keyword.term,
      rank: r.rank,
      popularity: r.keyword.popularity ?? 0,
    }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .slice(0, 20);

  const settings = await prisma.userSettings.findFirst();
  const anthropicKey = settings?.anthropicApiKey;
  const openaiKey = settings?.openaiApiKey;
  const useAnthropic =
    (settings?.aiProvider === "anthropic" || !openaiKey) && !!anthropicKey;

  if (!anthropicKey && !openaiKey) {
    logger.warn(
      "[SublineGen] No AI provider configured — skipping subline generation",
    );
    return {};
  }

  const screenshotList = Object.entries(descriptions)
    .map(([key, desc]) => `  - ${key}: ${desc}`)
    .join("\n");

  const keywordList = topKeywords
    .map(
      (k) =>
        `  ${k.term} (rank: ${k.rank ?? "unranked"}, popularity: ${k.popularity})`,
    )
    .join("\n");

  const localeList = detectedLocales.join(", ");

  const systemPrompt = `You are an expert Apple App Store Optimization (ASO) specialist.
Your task is to generate ultra-concise screenshot sublines that:
1. Are ≤ 30 characters each (HARD LIMIT — Apple's algorithm and space constraints)
2. Naturally include high-value keywords from the provided list (Apple scrapes text visible in screenshots)
3. Are benefit-driven and conversion-optimized (focus on user outcome, not features)
4. Feel native and natural in the target language (no awkward machine translations)
5. Use sentence case, not ALL CAPS

Respond with valid JSON only — no markdown, no explanation.`;

  const userPrompt = `App: ${app.name}
Current subtitle: ${app.currentSubtitle ?? "none"}
Current keywords: ${app.currentKeywords ?? "none"}

Top ranking keywords (use these naturally where they fit):
${keywordList || "  (none tracked yet)"}

Screenshots to generate sublines for:
${screenshotList}

Generate sublines for these locales: ${localeList}

Return JSON in this exact shape:
{
  "en-US": {
    "04_Community": "Connect & Share Stories",
    "05_Settings": "Your App, Your Rules"
  },
  "de-DE": {
    "04_Community": "Verbinden & Teilen",
    "05_Settings": "Dein App, dein Stil"
  }
}

Every subline must be ≤ 30 characters. Include every screenshot key for every locale.`;

  let raw = "";
  try {
    if (useAnthropic) {
      const client = new Anthropic({ apiKey: anthropicKey! });
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      raw = resp.content.find((c) => c.type === "text")?.text ?? "";
    } else {
      const client = new OpenAI({ apiKey: openaiKey! });
      const resp = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });
      raw = resp.choices[0]?.message?.content ?? "";
    }

    const jsonStr = raw
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    const sublines: ScreenshotSublines = JSON.parse(jsonStr);

    for (const locale of Object.keys(sublines)) {
      for (const key of Object.keys(sublines[locale])) {
        const text = sublines[locale][key];
        if (text.length > 30) {
          sublines[locale][key] = text.slice(0, 29) + "…";
        }
      }
    }

    logger.info(
      `[SublineGen] Generated sublines for ${Object.keys(sublines).length} locale(s), ` +
        `${Object.keys(descriptions).length} screenshot(s)`,
    );
    return sublines;
  } catch (err: any) {
    logger.error(`[SublineGen] AI call failed: ${err.message}`);
    return {};
  }
}
