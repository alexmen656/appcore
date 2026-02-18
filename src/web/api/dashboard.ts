import { Router } from "express";
import { prisma, env, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const activeBundleId =
      (req.query.bundleId as string | undefined) || settings.ascBundleId;

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
      where: { bundleId: activeBundleId },
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
        bundleId: settings.ascBundleId,
        country: settings.scrapeCountry,
        locales: settings.asoLocales.join(","),
        aiProvider: settings.aiProvider,
        hasOpenAI: !!settings.openaiApiKey,
        hasAnthropic: !!settings.anthropicApiKey,
        hasASC: !!(settings.ascIssuerId && settings.ascKeyId && settings.ascPrivateKey),
        hasSearchAds: !!env.APPLE_ADS_CLIENT_ID,
        scrapeInterval: settings.scrapeIntervalHours,
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
