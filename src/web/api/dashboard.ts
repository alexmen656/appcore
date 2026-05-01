import { Router } from "express";
import { prisma, env, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";
import { ensureAccentColor } from "../../services/utils/icon-accent";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const activeBundleId = req.query.bundleId as string | undefined;

    const ownApp = await prisma.app.findUnique({
      where: { bundleId: activeBundleId },
      include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
    });

    if (ownApp && req.user!.role !== "ADMIN" && (!ownApp.teamId || ownApp.teamId !== req.user!.teamId)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const appId = ownApp?.id;

    const [competitorCount, snapshotCount, keywordCount, rankingCount, pendingSuggestions, appliedSuggestions] =
      await Promise.all([
        appId
          ? prisma.competitorRelation.count({
              where: { OR: [{ appId }, { competitorId: appId }] },
            })
          : Promise.resolve(0),
        appId ? prisma.appSnapshot.count({ where: { appId } }) : Promise.resolve(0),
        appId
          ? prisma.keyword.count({
              where: { rankings: { some: { appId } } },
            })
          : Promise.resolve(0),
        appId ? prisma.keywordRanking.count({ where: { appId } }) : Promise.resolve(0),
        activeBundleId
          ? prisma.aSOSuggestion.count({
              where: { status: "PENDING", appBundleId: activeBundleId },
            })
          : Promise.resolve(0),
        activeBundleId
          ? prisma.aSOSuggestion.count({
              where: { status: "APPLIED", appBundleId: activeBundleId },
            })
          : Promise.resolve(0),
      ]);

    const recentSuggestions = await prisma.aSOSuggestion.findMany({
      where: activeBundleId ? { appBundleId: activeBundleId } : {},
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const accentColor = ownApp
      ? await ensureAccentColor(ownApp.id, ownApp.snapshots[0]?.iconUrl, {
          accentColor: ownApp.accentColor,
          accentColorIconUrl: ownApp.accentColorIconUrl,
        })
      : null;

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
            accentColor,
          }
        : null,
      stats: {
        apps: competitorCount,
        snapshots: snapshotCount,
        keywords: keywordCount,
        rankings: rankingCount,
        pendingSuggestions,
        appliedSuggestions,
      },
      config: {
        aiProvider: settings.aiProvider,
        hasOpenAI: !!settings.openaiApiKey,
        hasAnthropic: !!settings.anthropicApiKey,
        hasASC: !!(settings.ascIssuerId && settings.ascKeyId && settings.ascPrivateKey),
        hasSearchAds: !!env.APPLE_ADS_CLIENT_ID,
      },
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
