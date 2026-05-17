import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma, logger } from "../../../config";
import { createAscClient, getSettingsWithBundleId, verifyMcpAppAccess } from "./shared";

export function registerJobTools(server: McpServer, userId: string) {
  // @ts-ignore
  server.registerTool(
    "trigger_job",
    {
      description:
        "Trigger a background job for an app. Available jobs: " +
        "'scrape' (fetch latest App Store metadata for app + competitors), " +
        "'analyze' (run AI analysis and generate new ASO suggestions), " +
        "'sync' (pull current metadata from App Store Connect), " +
        "'track-keywords' (update keyword rankings), " +
        "'discover-keywords' (find new keyword opportunities). " +
        "Use list_apps to find available bundle IDs.",
      inputSchema: {
        job: z
          .enum(["scrape", "analyze", "sync", "track-keywords", "discover-keywords"])
          .describe("Which job to trigger"),
        bundleId: z
          .string()
          .optional()
          .describe(
            "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted. " +
              "When managing multiple apps always pass bundleId explicitly.",
          ),
      },
    },
    async ({ job, bundleId }) => {
      const { settings, resolvedBundleId } = await getSettingsWithBundleId(userId, bundleId);

      if (resolvedBundleId) {
        const app = await verifyMcpAppAccess(userId, resolvedBundleId);
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
      }

      const effectiveBundleId = resolvedBundleId ?? "";
      const appRecord = effectiveBundleId
        ? await prisma.app.findUnique({
            where: { bundleId: effectiveBundleId },
            select: { country: true },
          })
        : null;
      const appCountry = appRecord?.country ?? "de";

      const jobId = randomUUID();
      (async () => {
        try {
          if (job === "scrape") {
            const { AppStoreScraper } = await import("../../../services/appstore-scraper");
            await new AppStoreScraper(appCountry, undefined, effectiveBundleId).runFullScrapeJob();
          } else if (job === "analyze") {
            const { AIAnalyzer } = await import("../../../services/ai-analyzer");
            await new AIAnalyzer(effectiveBundleId).analyzeAndSuggest();
          } else if (job === "sync") {
            if (!effectiveBundleId) {
              logger.warn(`MCP sync job [${jobId}] skipped: no bundleId resolved`);
              return;
            }
            const asc = await createAscClient(settings);

            const ascApp = await asc.getApp(effectiveBundleId).catch(() => null);
            const ascLocalizations = ascApp ? await asc.getAppInfoLocalizations(ascApp.id).catch(() => []) : [];

            const syncLocales =
              ascLocalizations.length > 0
                ? ascLocalizations.map((l: any) => l.attributes?.locale ?? l.locale).filter(Boolean)
                : ["en-US"];

            const results: Record<string, any> = {};
            for (const locale of syncLocales) {
              const state = await asc.getCurrentASOState(locale, effectiveBundleId);
              if (state) results[locale] = state;
            }

            const primaryState = results[syncLocales[0]];

            if (primaryState) {
              await prisma.app.update({
                where: { bundleId: effectiveBundleId },
                data: {
                  currentTitle: primaryState.title,
                  currentSubtitle: primaryState.subtitle,
                  currentKeywords: primaryState.keywords,
                  currentDescription: primaryState.description,
                },
              });
            }
          } else if (job === "track-keywords") {
            const { KeywordTracker } = await import("../../../services/keyword-tracker");
            await new KeywordTracker(effectiveBundleId, appCountry, settings).trackAllKeywords();
          } else if (job === "discover-keywords") {
            const { KeywordDiscoveryAgent } = await import("../../../services/keyword-discovery-agent");
            await new KeywordDiscoveryAgent(effectiveBundleId, settings).run();
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
}
