import { Router } from "express";
import { prisma, logger, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// ─── GET /api/analytics/summary ──────────────────────────────────────────────
analyticsRouter.get("/summary", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || "";
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }

    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);

    const [downloadAgg, reviewAgg, lastSync] = await Promise.all([
      prisma.appStoreAnalytics.aggregate({
        where: { bundleId, reportDate: { gte: since30d } },
        _sum: { downloads: true, proceeds: true },
      }),
      prisma.appReview.aggregate({
        where: { bundleId },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.scrapeJob.findFirst({
        where: { type: "ASC_ANALYTICS", status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
    ]);

    res.json({
      totalDownloads30d: downloadAgg._sum.downloads ?? 0,
      totalProceeds30d: downloadAgg._sum.proceeds ?? 0,
      avgRating: reviewAgg._avg.rating ?? null,
      reviewCount: reviewAgg._count.id,
      lastSyncAt: lastSync?.completedAt ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/analytics/downloads ────────────────────────────────────────────
analyticsRouter.get("/downloads", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || "";
    const days = Math.min(parseInt(req.query.days as string, 10) || 30, 365);
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await prisma.appStoreAnalytics.findMany({
      where: { bundleId, reportDate: { gte: since } },
      orderBy: { reportDate: "asc" },
    });

    // Aggregate by day (sum across countries)
    const byDayMap: Record<
      string,
      { date: string; downloads: number; updates: number; proceeds: number }
    > = {};
    for (const r of rows) {
      const key = r.reportDate.toISOString().slice(0, 10);
      if (!byDayMap[key]) byDayMap[key] = { date: key, downloads: 0, updates: 0, proceeds: 0 };
      byDayMap[key].downloads += r.downloads;
      byDayMap[key].updates += r.updates;
      byDayMap[key].proceeds += r.proceeds;
    }

    // Aggregate by country (total over date range)
    const byCountryMap: Record<string, number> = {};
    for (const r of rows) {
      byCountryMap[r.country] = (byCountryMap[r.country] ?? 0) + r.downloads;
    }
    const byCountry = Object.entries(byCountryMap)
      .map(([country, downloads]) => ({ country, downloads }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 20);

    res.json({
      byDay: Object.values(byDayMap),
      byCountry,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/analytics/reviews ──────────────────────────────────────────────
analyticsRouter.get("/reviews", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || "";
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }

    const reviews = await prisma.appReview.findMany({
      where: { bundleId },
      orderBy: { reviewedAt: "desc" },
      take: limit,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        reviewerNickname: true,
        territory: true,
        reviewedAt: true,
      },
    });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/analytics/sync ─────────────────────────────────────────────────
// Fire-and-forget: returns immediately, runs sync in background.
analyticsRouter.post("/sync", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = (req.body.bundleId as string) || settings.ascBundleId;
    const ascAppId = settings.ascAppId;

    if (!settings.ascIssuerId || !settings.ascKeyId || !settings.ascPrivateKey) {
      res.status(400).json({ error: "App Store Connect credentials not configured." });
      return;
    }
    if (!settings.ascVendorNumber) {
      res.status(400).json({ error: "ASC Vendor Number not configured in Settings." });
      return;
    }

    res.json({ ok: true, message: `Analytics sync started for ${bundleId}` });

    const { syncAllAnalytics } = await import("../../services/asc-analytics");
    syncAllAnalytics(settings, bundleId, ascAppId)
      .then((r) => logger.info("Analytics sync completed", r))
      .catch((err) => logger.error("Analytics sync failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
