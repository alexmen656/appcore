import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { prisma, logger, getEffectiveSettings } from "../config";

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

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "AppCore ASO",
    version: "1.0.0",
  });

  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "list_apps",
    "List all apps managed in AppCore. Returns bundle IDs, names, and key metrics. " +
      "Always call this first to discover available bundle IDs before using other tools.",
    {
      ownOnly: z
        .boolean()
        .default(true)
        .describe(
          "When true (default) returns only your own apps. Set false to include tracked competitor apps too.",
        ),
    },
    async ({ ownOnly }) => {
      const apps = await prisma.app.findMany({
        where: ownOnly ? { isOwnApp: true } : undefined,
        include: {
          snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
          _count: { select: { rankings: true, competitors: true } },
        },
        orderBy: [{ isOwnApp: "desc" }, { name: "asc" }],
      });

      const result = apps.map((a) => ({
        bundleId: a.bundleId,
        name: a.name,
        isOwnApp: a.isOwnApp,
        country: a.country,
        title: a.currentTitle,
        subtitle: a.currentSubtitle,
        rating: a.snapshots[0]?.rating ?? null,
        ratingsCount: a.snapshots[0]?.ratingsCount ?? null,
        iconUrl: a.snapshots[0]?.iconUrl ?? null,
        trackedKeywords: a._count.rankings,
        competitors: a._count.competitors,
        lastScraped: a.snapshots[0]?.scrapedAt ?? null,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "get_app_info",
    "Get current ASO metadata (title, subtitle, keywords, description) for a specific app. " +
      "Use list_apps first to find available bundle IDs.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Falls back to the user's default app if omitted.",
        ),
    },
    async ({ bundleId }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;
      if (!resolvedBundleId) {
        return {
          content: [
            {
              type: "text",
              text: "No bundleId provided and no default configured. Call list_apps to see available apps.",
            },
          ],
        };
      }
      const app = await prisma.app.findUnique({
        where: { bundleId: resolvedBundleId },
        include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
      });
      if (!app) {
        return {
          content: [
            {
              type: "text",
              text: `App not found: ${resolvedBundleId}. Call list_apps to see valid bundle IDs.`,
            },
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
                isOwnApp: app.isOwnApp,
                country: app.country,
                title: app.currentTitle,
                subtitle: app.currentSubtitle,
                keywords: app.currentKeywords,
                description: app.currentDescription,
                rating: app.snapshots[0]?.rating ?? null,
                ratingsCount: app.snapshots[0]?.ratingsCount ?? null,
                version: app.snapshots[0]?.version ?? null,
                lastScraped: app.snapshots[0]?.scrapedAt ?? null,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_keywords",
    "Get tracked keywords with current App Store rankings, popularity scores, and difficulty for an app. " +
      "Use list_apps to find the bundleId first.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
        ),
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

  server.tool(
    "get_competitors",
    "Get competitor apps tracked for an app, including ratings, relevance scores, and latest metadata. " +
      "Use list_apps to find the bundleId first.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
        ),
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

  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "get_suggestions",
    "Get AI-generated ASO suggestions (title, subtitle, keywords, description) for an app. " +
      "Filter by status: PENDING (awaiting review), APPROVED (ready to apply), APPLIED, REJECTED, EXPIRED. " +
      "Use update_suggestion to approve or reject individual suggestions.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
        ),
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

  server.tool(
    "get_analytics",
    "Get downloads, revenue, impressions, and page views summary for an app over a configurable date range. " +
      "Use list_apps to find available bundle IDs.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
        ),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Number of days to look back (default 30, max 365)"),
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
          _sum: {
            downloads: true,
            proceeds: true,
            updates: true,
            impressions: true,
            pageViews: true,
          },
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
                totalImpressions: downloadAgg._sum.impressions ?? 0,
                totalPageViews: downloadAgg._sum.pageViews ?? 0,
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

  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "trigger_job",
    "Trigger a background job for an app. Available jobs: " +
      "'scrape' (fetch latest App Store metadata for app + competitors), " +
      "'analyze' (run AI analysis and generate new ASO suggestions), " +
      "'sync' (pull current metadata from App Store Connect), " +
      "'track-keywords' (update keyword rankings), " +
      "'discover-keywords' (find new keyword opportunities). " +
      "Use list_apps to find available bundle IDs.",
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
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted. " +
            "When managing multiple apps always pass bundleId explicitly.",
        ),
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

  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "get_reviews",
    "Get App Store reviews for an app. Returns rating, title, body, territory, and review date. " +
      "Use list_apps to find the bundleId first.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
        ),
      minRating: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("Only return reviews at or above this star rating (1-5)."),
      maxRating: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("Only return reviews at or below this star rating (1-5)."),
      territory: z
        .string()
        .optional()
        .describe(
          "Filter by territory code, e.g. 'DEU', 'USA'. Returns all territories if omitted.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe("Max reviews to return (default 50, max 200)"),
    },
    async ({ bundleId, minRating, maxRating, territory, limit }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;
      if (!resolvedBundleId) {
        return {
          content: [
            {
              type: "text",
              text: "No bundleId provided. Call list_apps to see available apps.",
            },
          ],
        };
      }

      const where: Record<string, any> = { bundleId: resolvedBundleId };
      if (minRating !== undefined || maxRating !== undefined) {
        where.rating = {};
        if (minRating !== undefined) where.rating.gte = minRating;
        if (maxRating !== undefined) where.rating.lte = maxRating;
      }
      if (territory) where.territory = territory;

      const reviews = await prisma.appReview.findMany({
        where,
        orderBy: { reviewedAt: "desc" },
        take: limit,
      });

      const result = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        reviewer: r.reviewerNickname,
        territory: r.territory,
        reviewedAt: r.reviewedAt,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // @ts-ignore - MCP SDK causes excessively deep type instantiation
  server.tool(
    "update_suggestion",
    "Update the status of an ASO suggestion. Use this to approve, reject, or mark suggestions as applied. " +
      "Get suggestion IDs from get_suggestions.",
    {
      id: z.string().describe("The suggestion ID returned by get_suggestions."),
      status: z
        .enum(["APPROVED", "REJECTED", "APPLIED", "PENDING", "EXPIRED"])
        .describe("New status to set for the suggestion."),
      resultNotes: z
        .string()
        .optional()
        .describe(
          "Optional notes to record (e.g. 'Applied to en-US locale', or reason for rejection).",
        ),
    },
    async ({ id, status, resultNotes }) => {
      const suggestion = await prisma.aSOSuggestion.findUnique({
        where: { id },
      });
      if (!suggestion) {
        return {
          content: [{ type: "text", text: `Suggestion not found: ${id}` }],
        };
      }

      const updated = await prisma.aSOSuggestion.update({
        where: { id },
        data: {
          status,
          ...(resultNotes ? { resultNotes } : {}),
          ...(status === "APPLIED" ? { appliedAt: new Date() } : {}),
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                id: updated.id,
                type: updated.type,
                locale: updated.locale,
                status: updated.status,
                appliedAt: updated.appliedAt,
                resultNotes: updated.resultNotes,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}

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
