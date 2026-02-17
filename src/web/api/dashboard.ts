import { Router } from "express";
import { prisma, env } from "../../config";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (_req, res) => {
  try {
    const [
      appCount,
      snapshotCount,
      keywordCount,
      rankingCount,
      pendingSuggestions,
      appliedSuggestions,
      jobCount,
    ] = await Promise.all([
      prisma.app.count(),
      prisma.appSnapshot.count(),
      prisma.keyword.count(),
      prisma.keywordRanking.count(),
      prisma.aSOSuggestion.count({ where: { status: "PENDING" } }),
      prisma.aSOSuggestion.count({ where: { status: "APPLIED" } }),
      prisma.scrapeJob.count(),
    ]);

    const ownApp = await prisma.app.findUnique({
      where: { bundleId: env.ASC_BUNDLE_ID },
      include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
    });

    const lastJob = await prisma.scrapeJob.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const recentSuggestions = await prisma.aSOSuggestion.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    res.json({
      app: ownApp
        ? {
            name: ownApp.name,
            bundleId: ownApp.bundleId,
            title: ownApp.currentTitle,
            subtitle: ownApp.currentSubtitle,
            keywords: ownApp.currentKeywords,
            rating: ownApp.snapshots[0]?.rating,
            ratingsCount: ownApp.snapshots[0]?.ratingsCount,
            iconUrl: ownApp.snapshots[0]?.iconUrl,
          }
        : null,
      stats: {
        apps: appCount,
        snapshots: snapshotCount,
        keywords: keywordCount,
        rankings: rankingCount,
        pendingSuggestions,
        appliedSuggestions,
        jobs: jobCount,
      },
      config: {
        bundleId: env.ASC_BUNDLE_ID,
        country: env.SCRAPE_COUNTRY,
        locales: env.ASO_LOCALES,
        aiProvider: env.AI_PROVIDER,
        hasOpenAI: !!env.OPENAI_API_KEY,
        hasAnthropic: !!env.ANTHROPIC_API_KEY,
        hasASC: !!env.ASC_ISSUER_ID,
        hasSearchAds: !!env.APPLE_ADS_CLIENT_ID,
        scrapeInterval: env.SCRAPE_INTERVAL_HOURS,
      },
      lastJob: lastJob
        ? {
            type: lastJob.type,
            status: lastJob.status,
            createdAt: lastJob.createdAt,
            itemsCount: lastJob.itemsCount,
          }
        : null,
      recentSuggestions: recentSuggestions.map((s) => ({
        id: s.id,
        type: s.type,
        locale: s.locale,
        value: s.suggestedValue.substring(0, 80),
        confidence: s.confidenceScore,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
