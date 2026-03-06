import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { prisma, logger, getEffectiveSettings } from "../config";

// ─── MCP API Key Auth ─────────────────────────────────────────────────────────
export async function mcpAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "MCP: Missing or invalid Authorization header" });
    return;
  }
  const key = header.slice(7).trim();
  if (!key) {
    res.status(401).json({ error: "MCP: Empty API key" });
    return;
  }
  try {
    const settings = await prisma.userSettings.findFirst({
      where: { mcpApiKey: key, mcpEnabled: true },
    });
    if (!settings) {
      res.status(401).json({ error: "MCP: Invalid or disabled API key" });
      return;
    }
    (req as any).mcpUserId = settings.userId;
    next();
  } catch (err) {
    logger.error("MCP auth error", err);
    res.status(500).json({ error: "MCP: Internal auth error" });
  }
}

// ─── MCP Server Factory ───────────────────────────────────────────────────────
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "AppCore ASO",
    version: "1.0.0",
  });

  // ── Tool: get_app_info ──────────────────────────────────────────────────
  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "get_app_info",
    "Get current ASO metadata (title, subtitle, keywords, description) for an app",
    {
      bundleId: z
        .string()
        .optional()
        .describe("App bundle ID. Uses the user's default app if omitted."),
    },
    async ({ bundleId }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;
      if (!resolvedBundleId) {
        return {
          content: [
            {
              type: "text",
              text: "No bundleId configured. Pass bundleId as argument.",
            },
          ],
        };
      }
      const app = await prisma.app.findUnique({
        where: { bundleId: resolvedBundleId },
      });
      if (!app) {
        return {
          content: [
            { type: "text", text: `App not found: ${resolvedBundleId}` },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                bundleId: app.bundleId,
                name: app.name,
                title: app.currentTitle,
                subtitle: app.currentSubtitle,
                keywords: app.currentKeywords,
                description: app.currentDescription,
                isOwnApp: app.isOwnApp,
                country: app.country,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Tool: get_keywords ──────────────────────────────────────────────────
  server.tool(
    "get_keywords",
    "Get tracked keywords with current rankings and popularity scores for an app",
    {
      bundleId: z
        .string()
        .optional()
        .describe("App bundle ID. Uses default if omitted."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe("Max keywords to return (default 50, max 200)"),
    },
    async ({ bundleId, limit }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;

      const app = resolvedBundleId
        ? await prisma.app.findUnique({ where: { bundleId: resolvedBundleId } })
        : null;

      const keywords = await prisma.keyword.findMany({
        where: app ? { rankings: { some: { appId: app.id } } } : undefined,
        include: {
          rankings: app
            ? {
                where: { appId: app.id },
                orderBy: { trackedAt: "desc" },
                take: 1,
              }
            : undefined,
        },
        orderBy: { popularity: "desc" },
        take: limit,
      });

      const result = keywords.map((k) => ({
        term: k.term,
        country: k.country,
        popularity: k.popularity,
        difficulty: k.difficulty,
        searchVolume: k.searchVolume,
        rank: k.rankings?.[0]?.rank ?? null,
        trackedAt: k.rankings?.[0]?.trackedAt ?? null,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: get_competitors ───────────────────────────────────────────────
  server.tool(
    "get_competitors",
    "Get competitor apps list with ratings and relevance scores",
    {
      bundleId: z
        .string()
        .optional()
        .describe("App bundle ID. Uses default if omitted."),
    },
    async ({ bundleId }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;
      if (!resolvedBundleId) {
        return { content: [{ type: "text", text: "No bundleId configured." }] };
      }
      const app = await prisma.app.findUnique({
        where: { bundleId: resolvedBundleId },
      });
      if (!app) {
        return {
          content: [
            { type: "text", text: `App not found: ${resolvedBundleId}` },
          ],
        };
      }
      const rels = await prisma.competitorRelation.findMany({
        where: { appId: app.id },
        include: {
          competitor: {
            include: {
              snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
            },
          },
        },
      });
      const result = rels.map((r) => ({
        bundleId: r.competitor.bundleId,
        name: r.competitor.name,
        rating: r.competitor.snapshots[0]?.rating ?? null,
        ratingsCount: r.competitor.snapshots[0]?.ratingsCount ?? null,
        title: r.competitor.snapshots[0]?.title ?? null,
        relevanceScore: r.relevanceScore,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: get_suggestions ───────────────────────────────────────────────
  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "get_suggestions",
    "Get AI-generated ASO suggestions filtered by status (PENDING, APPROVED, APPLIED, REJECTED, EXPIRED)",
    {
      bundleId: z
        .string()
        .optional()
        .describe("App bundle ID. Uses default if omitted."),
      status: z
        .enum(["PENDING", "APPROVED", "APPLIED", "REJECTED", "EXPIRED"])
        .optional()
        .describe(
          "Filter by suggestion status. Returns all statuses if omitted.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Max suggestions to return (default 20)"),
    },
    async ({ bundleId, status, limit }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;

      const where: Record<string, any> = {};
      if (resolvedBundleId) where.appBundleId = resolvedBundleId;
      if (status) where.status = status;

      const suggestions = await prisma.aSOSuggestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const result = suggestions.map((s) => ({
        id: s.id,
        type: s.type,
        locale: s.locale,
        suggestedValue: s.suggestedValue,
        currentValue: s.currentValue,
        reasoning: s.reasoning,
        confidenceScore: s.confidenceScore,
        estimatedImpact: s.estimatedImpact,
        status: s.status,
        aiProvider: s.aiProvider,
        createdAt: s.createdAt,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: get_analytics ─────────────────────────────────────────────────
  server.tool(
    "get_analytics",
    "Get downloads and revenue summary for a configurable date range",
    {
      bundleId: z
        .string()
        .optional()
        .describe("App bundle ID. Uses default if omitted."),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Number of days to look back (default 30)"),
    },
    async ({ bundleId, days }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;
      if (!resolvedBundleId) {
        return { content: [{ type: "text", text: "No bundleId configured." }] };
      }

      const since = new Date();
      since.setDate(since.getDate() - days);

      const [downloadAgg, reviewAgg] = await Promise.all([
        prisma.appStoreAnalytics.aggregate({
          where: { bundleId: resolvedBundleId, reportDate: { gte: since } },
          _sum: { downloads: true, proceeds: true, updates: true },
        }),
        prisma.appReview.aggregate({
          where: { bundleId: resolvedBundleId },
          _avg: { rating: true },
          _count: { id: true },
        }),
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                bundleId: resolvedBundleId,
                periodDays: days,
                since: since.toISOString().split("T")[0],
                totalDownloads: downloadAgg._sum.downloads ?? 0,
                totalUpdates: downloadAgg._sum.updates ?? 0,
                totalProceedsUsd: downloadAgg._sum.proceeds ?? 0,
                avgRating: reviewAgg._avg.rating ?? null,
                totalReviews: reviewAgg._count.id,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Tool: trigger_job ───────────────────────────────────────────────────
  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "trigger_job",
    "Trigger a background job. Available: scrape, analyze, sync, track-keywords, discover-keywords",
    {
      job: z
        .enum([
          "scrape",
          "analyze",
          "sync",
          "track-keywords",
          "discover-keywords",
        ])
        .describe("Which job to trigger"),
      bundleId: z
        .string()
        .optional()
        .describe("App bundle ID. Uses default if omitted."),
    },
    async ({ job, bundleId }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;
      const effectiveSettings = { ...settings, ascBundleId: resolvedBundleId };

      const jobId = randomUUID();
      (async () => {
        try {
          if (job === "scrape") {
            const { AppStoreScraper } =
              await import("../services/appstore-scraper");
            await new AppStoreScraper(effectiveSettings).runFullScrapeJob();
          } else if (job === "analyze") {
            const { AIAnalyzer } = await import("../services/ai-analyzer");
            await new AIAnalyzer(effectiveSettings).analyzeAndSuggest(
              settings.asoLocales,
            );
          } else if (job === "sync") {
            const { AppStoreConnectClient } =
              await import("../services/appstore-connect");
            const asc = new AppStoreConnectClient({
              issuerId: settings.ascIssuerId,
              keyId: settings.ascKeyId,
              privateKey: settings.ascPrivateKey,
            });
            for (const locale of settings.asoLocales) {
              await asc.getCurrentASOState(locale);
            }
          } else if (job === "track-keywords") {
            const { KeywordTracker } =
              await import("../services/keyword-tracker");
            await new KeywordTracker(effectiveSettings).trackAllKeywords();
          } else if (job === "discover-keywords") {
            const { KeywordDiscoveryAgent } =
              await import("../services/keyword-discovery-agent");
            await new KeywordDiscoveryAgent(effectiveSettings).run();
          }
          logger.info(`MCP-triggered job "${job}" [${jobId}] completed`);
        } catch (err) {
          logger.error(`MCP-triggered job "${job}" [${jobId}] failed`, err);
        }
      })();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              jobId,
              message: `Job "${job}" started for ${resolvedBundleId || "default app"}`,
            }),
          },
        ],
      };
    },
  );

  return server;
}

// ─── Express Handler Factory ──────────────────────────────────────────────────
export function createMcpHandler() {
  return async (req: Request, res: Response) => {
    const userId = (req as any).mcpUserId as string;
    try {
      const server = createMcpServer(userId);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error("MCP handler error", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP: Internal server error" });
      }
    }
  };
}
