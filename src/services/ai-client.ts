import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { EffectiveSettings } from "../config";

export interface AIQueryOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  openaiModel?: string;
  anthropicModel?: string;
}

export interface AIResponse {
  content: string;
  provider: "openai" | "anthropic";
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4000;

type AISettings = Pick<
  EffectiveSettings,
  "openaiApiKey" | "anthropicApiKey" | "aiProvider"
>;

export class AIClient {
  private readonly openai?: OpenAI;
  private readonly anthropic?: Anthropic;
  private readonly preferredProvider?: "openai" | "anthropic";

  constructor(settings?: Partial<AISettings>) {
    if (settings?.openaiApiKey)
      this.openai = new OpenAI({ apiKey: settings.openaiApiKey });
    if (settings?.anthropicApiKey)
      this.anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });
    this.preferredProvider = settings?.aiProvider as
      | "openai"
      | "anthropic"
      | undefined;
  }

  get hasProvider(): boolean {
    return !!(this.openai || this.anthropic);
  }

  async query(
    systemPrompt: string,
    userPrompt: string,
    options?: AIQueryOptions,
  ): Promise<AIResponse> {
    if (this.preferredProvider === "anthropic" && this.anthropic) {
      return this.callAnthropic(systemPrompt, userPrompt, options);
    }
    if (this.openai) {
      return this.callOpenAI(systemPrompt, userPrompt, options);
    }
    if (this.anthropic) {
      return this.callAnthropic(systemPrompt, userPrompt, options);
    }
    throw new Error("No AI provider available");
  }

  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    options?: AIQueryOptions,
  ): Promise<AIResponse> {
    const model = options?.openaiModel ?? DEFAULT_OPENAI_MODEL;
    const response = await this.openai!.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      max_completion_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(options?.jsonMode
        ? { response_format: { type: "json_object" } }
        : {}),
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      provider: "openai",
      model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    };
  }

  private async callAnthropic(
    systemPrompt: string,
    userPrompt: string,
    options?: AIQueryOptions,
  ): Promise<AIResponse> {
    const model = options?.anthropicModel ?? DEFAULT_ANTHROPIC_MODEL;
    const response = await this.anthropic!.messages.create({
      model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      ...(options?.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      content: text,
      provider: "anthropic",
      model,
      promptTokens: response.usage?.input_tokens,
      completionTokens: response.usage?.output_tokens,
    };
  }
}
