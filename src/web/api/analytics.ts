import { Router } from "express";
import { prisma, logger, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function resolveSince(query: Record<string, any>): Date | null {
  if (query.period === "all") return null;

  if (query.startDate) {
    return new Date(query.startDate as string);
  }

  if (query.period === "ytd") {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  }

  const days = parseInt(query.days as string, 10);
  if (!isNaN(days) && days > 0) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  const def = new Date();
  def.setDate(def.getDate() - 30);
  return def;
}

function resolveUntil(query: Record<string, any>): Date | null {
  if (query.endDate) return new Date(query.endDate as string);
  return null;
}

// ─── GET /api/analytics/summary ──────────────────────────────────────────────
analyticsRouter.get("/summary", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || "";
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }

    const since = resolveSince(req.query);
    const until = resolveUntil(req.query);
    const dateFilter: Record<string, Date> = {};
    if (since) dateFilter.gte = since;
    if (until) dateFilter.lte = until;

    const [metricAgg, reviewAgg, lastSync] = await Promise.all([
      prisma.appStoreAnalytics.aggregate({
        where: {
          bundleId,
          ...(Object.keys(dateFilter).length ? { reportDate: dateFilter } : {}),
        },
        _sum: {
          downloads: true,
          proceeds: true,
          impressions: true,
          pageViews: true,
          sessions: true,
        },
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

    const downloads = metricAgg._sum.downloads ?? 0;
    const impressions = metricAgg._sum.impressions ?? 0;
    const pageViews = metricAgg._sum.pageViews ?? 0;

    res.json({
      totalDownloads: downloads,
      totalProceeds: metricAgg._sum.proceeds ?? 0,
      totalImpressions: impressions,
      totalPageViews: pageViews,
      totalSessions: metricAgg._sum.sessions ?? 0,
      conversionRate: impressions > 0 ? (downloads / impressions) * 100 : null,
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
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }

    const since = resolveSince(req.query);
    const until = resolveUntil(req.query);
    const dateFilter: Record<string, Date> = {};
    if (since) dateFilter.gte = since;
    if (until) dateFilter.lte = until;

    const rows = await prisma.appStoreAnalytics.findMany({
      where: {
        bundleId,
        ...(Object.keys(dateFilter).length ? { reportDate: dateFilter } : {}),
      },
      orderBy: { reportDate: "asc" },
    });

    const byDayMap: Record<
      string,
      {
        date: string;
        downloads: number;
        updates: number;
        proceeds: number;
        impressions: number;
        pageViews: number;
        sessions: number;
      }
    > = {};
    for (const r of rows) {
      const key = r.reportDate.toISOString().slice(0, 10);
      if (!byDayMap[key])
        byDayMap[key] = {
          date: key,
          downloads: 0,
          updates: 0,
          proceeds: 0,
          impressions: 0,
          pageViews: 0,
          sessions: 0,
        };
      byDayMap[key].downloads += r.downloads;
      byDayMap[key].updates += r.updates;
      byDayMap[key].proceeds += r.proceeds;
      byDayMap[key].impressions += r.impressions;
      byDayMap[key].pageViews += r.pageViews;
      byDayMap[key].sessions += r.sessions;
    }

    const byCountryMap: Record<
      string,
      { downloads: number; impressions: number; pageViews: number }
    > = {};
    for (const r of rows) {
      if (!byCountryMap[r.country]) {
        byCountryMap[r.country] = {
          downloads: 0,
          impressions: 0,
          pageViews: 0,
        };
      }
      byCountryMap[r.country].downloads += r.downloads;
      byCountryMap[r.country].impressions += r.impressions;
      byCountryMap[r.country].pageViews += r.pageViews;
    }
    const byCountry = Object.entries(byCountryMap)
      .map(([country, v]) => ({ country, ...v }))
      .sort((a, b) => b.downloads - a.downloads);

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

// ─── GET /api/analytics/markers ──────────────────────────────────────────────
// Returns version-update dates + app activation date for chart reference lines
analyticsRouter.get("/markers", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || "";
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }

    const app = await prisma.app.findUnique({
      where: { bundleId },
      select: { id: true, createdAt: true, isOwnApp: true, trackId: true },
    });

    if (!app) {
      res.json({ activatedAt: null, versionUpdates: [] });
      return;
    }

    let versionChanges = await prisma.appMetadataChange.findMany({
      where: { appId: app.id, field: "version" },
      orderBy: { detectedAt: "asc" },
      select: { newValue: true, detectedAt: true },
    });

    // Lazy-init: if no version history yet, scrape it from the App Store
    if (versionChanges.length === 0 && app.isOwnApp && app.trackId) {
      const { AppStoreScraper } = await import("../../services/appstore-scraper");
      const scraper = new AppStoreScraper();
      const history = await scraper.scrapeVersionHistory(Number(app.trackId));
      for (const { version, date } of history) {
        await prisma.appMetadataChange.create({
          data: {
            appId: app.id,
            field: "version",
            oldValue: null,
            newValue: version,
            detectedAt: new Date(date),
          },
        });
      }
      if (history.length > 0) {
        versionChanges = await prisma.appMetadataChange.findMany({
          where: { appId: app.id, field: "version" },
          orderBy: { detectedAt: "asc" },
          select: { newValue: true, detectedAt: true },
        });
      }
    }

    res.json({
      activatedAt: app.createdAt.toISOString().slice(0, 10),
      versionUpdates: versionChanges.map((c) => ({
        date: c.detectedAt.toISOString().slice(0, 10),
        version: c.newValue ?? "",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/analytics/sync ─────────────────────────────────────────────────
analyticsRouter.post("/sync", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const settings = await getEffectiveSettings(userId);

    if (
      !settings.ascIssuerId ||
      !settings.ascKeyId ||
      !settings.ascPrivateKey
    ) {
      res
        .status(400)
        .json({ error: "App Store Connect credentials not configured." });
      return;
    }
    if (!settings.ascVendorNumber) {
      res
        .status(400)
        .json({ error: "ASC Vendor Number not configured in Settings." });
      return;
    }

    const requestedBundleId = (req.body.bundleId as string) || null;
    const ownApps = await prisma.app.findMany({
      where: {
        isOwnApp: true,
        ...(requestedBundleId ? { bundleId: requestedBundleId } : {}),
      },
      select: { bundleId: true, trackId: true, name: true },
    });

    if (ownApps.length === 0) {
      res.status(400).json({
        error:
          "No own apps found. Add your app in the Apps section first and mark it as 'Own App'.",
      });
      return;
    }

    res.json({
      ok: true,
      message: `Analytics sync started for ${ownApps.map((a) => a.name).join(", ")}`,
    });

    const { syncAllAnalytics } = await import("../../services/asc-analytics");

    (async () => {
      for (const app of ownApps) {
        const ascAppId = app.trackId?.toString() ?? settings.ascAppId ?? "";
        try {
          const r = await syncAllAnalytics(
            settings,
            app.bundleId,
            ascAppId,
            userId,
          );
          logger.info(`Analytics sync completed for ${app.bundleId}`, r);
        } catch (err: any) {
          logger.error(`Analytics sync failed for ${app.bundleId}`, err);
        }
      }
    })();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
