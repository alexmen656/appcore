import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma, logger } from "../../../config";
import { createAscClient, getSettingsWithBundleId } from "./shared";

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
    },
    async ({ job, bundleId }) => {
      const { settings, resolvedBundleId } = await getSettingsWithBundleId(
        userId,
        bundleId,
      );
      const effectiveSettings = { ...settings, ascBundleId: resolvedBundleId };

      const jobId = randomUUID();
      (async () => {
        try {
          if (job === "scrape") {
            const { AppStoreScraper } =
              await import("../../../services/appstore-scraper");
            await new AppStoreScraper(effectiveSettings).runFullScrapeJob();
          } else if (job === "analyze") {
            const { AIAnalyzer } =
              await import("../../../services/ai-analyzer");
            await new AIAnalyzer(effectiveSettings).analyzeAndSuggest();
          } else if (job === "sync") {
            const asc = await createAscClient(settings);

            const ascLocalizations = settings.ascAppId
              ? await asc
                  .getAppInfoLocalizations(settings.ascAppId)
                  .catch(() => [])
              : [];

            const syncLocales =
              ascLocalizations.length > 0
                ? ascLocalizations
                    .map((l: any) => l.attributes?.locale ?? l.locale)
                    .filter(Boolean)
                : ["en-US"];

            const results: Record<string, any> = {};
            for (const locale of syncLocales) {
              const state = await asc.getCurrentASOState(locale);
              if (state) results[locale] = state;
            }

            const primaryState = results[syncLocales[0]];
            let effectiveBundleId = resolvedBundleId;
            if (!effectiveBundleId && primaryState?.appId) {
              const appByTrackId = await prisma.app.findFirst({
                where: { trackId: BigInt(primaryState.appId) },
                select: { bundleId: true },
              });
              effectiveBundleId = appByTrackId?.bundleId ?? "";
            }

            if (primaryState && effectiveBundleId) {
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
            const { KeywordTracker } =
              await import("../../../services/keyword-tracker");
            await new KeywordTracker(effectiveSettings).trackAllKeywords();
          } else if (job === "discover-keywords") {
            const { KeywordDiscoveryAgent } =
              await import("../../../services/keyword-discovery-agent");
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
}
