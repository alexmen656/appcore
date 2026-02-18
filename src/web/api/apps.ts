import { Router } from "express";
import { prisma, env } from "../../config";

export const appsRouter = Router();

appsRouter.get("/", async (req, res) => {
  try {
    const apps = await prisma.app.findMany({
      include: {
        snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
        _count: {
          select: {
            competitors: true,
            competitorOf: true,
            rankings: true,
          },
        },
      },
      orderBy: [{ isOwnApp: "desc" }, { name: "asc" }],
    });

    res.json(
      apps.map((a) => ({
        id: a.id,
        bundleId: a.bundleId,
        name: a.name,
        trackId: a.trackId?.toString() ?? null,
        country: a.country,
        isOwnApp: a.isOwnApp,
        title: a.currentTitle,
        subtitle: a.currentSubtitle,
        keywords: a.currentKeywords,
        rating: a.snapshots[0]?.rating ?? null,
        ratingsCount: a.snapshots[0]?.ratingsCount ?? null,
        iconUrl: a.snapshots[0]?.iconUrl ?? null,
        competitorCount: a._count.competitors + a._count.competitorOf,
        rankingCount: a._count.rankings,
        updatedAt: a.updatedAt,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

appsRouter.get("/:id", async (req, res) => {
  try {
    const app = await prisma.app.findUnique({
      where: { id: req.params.id },
      include: {
        snapshots: { orderBy: { scrapedAt: "desc" }, take: 20 },
        competitors: {
          include: {
            competitor: {
              include: {
                snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
              },
            },
          },
        },
        competitorOf: {
          include: {
            app: {
              include: {
                snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!app) return res.status(404).json({ error: "App not found" });

    const allCompetitors = [
      ...app.competitors.map((c) => ({
        id: c.competitor.id,
        name: c.competitor.name,
        bundleId: c.competitor.bundleId,
        relevance: c.relevanceScore,
        rating: c.competitor.snapshots[0]?.rating,
        iconUrl: c.competitor.snapshots[0]?.iconUrl,
      })),
      ...app.competitorOf.map((c) => ({
        id: c.app.id,
        name: c.app.name,
        bundleId: c.app.bundleId,
        relevance: c.relevanceScore,
        rating: c.app.snapshots[0]?.rating,
        iconUrl: c.app.snapshots[0]?.iconUrl,
      })),
    ];

    res.json({
      id: app.id,
      bundleId: app.bundleId,
      name: app.name,
      trackId: app.trackId?.toString() ?? null,
      country: app.country,
      isOwnApp: app.isOwnApp,
      title: app.currentTitle,
      subtitle: app.currentSubtitle,
      keywords: app.currentKeywords,
      description: app.currentDescription,
      snapshots: app.snapshots.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        rating: s.rating,
        ratingsCount: s.ratingsCount,
        version: s.version,
        iconUrl: s.iconUrl,
        developerName: s.developerName,
        category: s.category,
        screenshotUrls: s.screenshotUrls,
        scrapedAt: s.scrapedAt,
      })),
      competitors: allCompetitors,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
