import { Router } from "express";
import { prisma } from "../../config";
import { getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const appsRouter = Router();

appsRouter.get("/", async (req, res) => {
  try {
    const bundleId = req.query.bundleId as string | undefined;
    const isAdmin = req.user!.role === "ADMIN";
    const teamId = req.user!.teamId;
    let whereClause: any = {};

    if (bundleId) {
      const activeApp = await prisma.app.findUnique({ where: { bundleId } });
      if (activeApp) {
        if (!isAdmin && activeApp.teamId && activeApp.teamId !== teamId) {
          res.json([]);
          return;
        }
        const rels = await prisma.competitorRelation.findMany({
          where: {
            OR: [{ appId: activeApp.id }, { competitorId: activeApp.id }],
          },
        });
        const relatedIds = rels.map((r) =>
          r.appId === activeApp.id ? r.competitorId : r.appId,
        );
        whereClause = {
          OR: [{ id: activeApp.id }, { id: { in: relatedIds } }],
        };
      }
    } else if (!isAdmin && teamId) {
      const member = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: req.user!.userId } },
        include: { appAccess: true },
      });
      const isPrivileged = member?.role === "OWNER" || member?.role === "ADMIN";
      if (!isPrivileged && member && member.appAccess.length > 0) {
        const allowedAppIds = member.appAccess.map((a) => a.appId);
        whereClause = {
          OR: [{ id: { in: allowedAppIds } }, { isOwnApp: false }],
        };
      } else {
        whereClause = {
          OR: [{ teamId }, { isOwnApp: false }],
        };
      }
    }

    const apps = await prisma.app.findMany({
      where: whereClause,
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

appsRouter.delete("/:ownAppId/competitors/:competitorId", async (req, res) => {
  try {
    const { ownAppId, competitorId } = req.params;
    await prisma.competitorRelation.deleteMany({
      where: {
        OR: [
          { appId: ownAppId, competitorId },
          { appId: competitorId, competitorId: ownAppId },
        ],
      },
    });
    res.json({ ok: true });
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

appsRouter.get("/:id/competitor-detail", async (req, res) => {
  try {
    const bundleId = req.query.bundleId as string | undefined;
    const app = await prisma.app.findUnique({
      where: { id: req.params.id },
      include: {
        snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 },
      },
    });

    if (!app) return res.status(404).json({ error: "App not found" });

    const reviews = await prisma.competitorReview.findMany({
      where: { appId: app.id },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    });

    const latestSummary = await prisma.competitorReviewSummary.findFirst({
      where: { appId: app.id },
      orderBy: { createdAt: "desc" },
    });

    const metadataChanges = await prisma.appMetadataChange.findMany({
      where: { appId: app.id },
      orderBy: { detectedAt: "desc" },
      take: 50,
    });

    let keywordRankings: Array<{
      keyword: string;
      keywordId: string;
      popularity: number | null;
      competitorRank: number | null;
      ourRank: number | null;
    }> = [];

    if (bundleId) {
      const ownApp = await prisma.app.findUnique({ where: { bundleId } });
      if (ownApp) {
        const keywords = await prisma.keyword.findMany({
          where: { rankings: { some: { appId: ownApp.id } } },
          orderBy: { popularity: "desc" },
        });

        for (const kw of keywords) {
          const compRanking = await prisma.keywordRanking.findFirst({
            where: { keywordId: kw.id, appId: app.id },
            orderBy: { trackedAt: "desc" },
          });

          const ourRanking = await prisma.keywordRanking.findFirst({
            where: { keywordId: kw.id, appId: ownApp.id },
            orderBy: { trackedAt: "desc" },
          });

          keywordRankings.push({
            keyword: kw.term,
            keywordId: kw.id,
            popularity: kw.popularity,
            competitorRank: compRanking?.rank ?? null,
            ourRank: ourRanking?.rank ?? null,
          });
        }
      }
    }

    const snapshot = app.snapshots[0];

    res.json({
      id: app.id,
      bundleId: app.bundleId,
      name: app.name,
      trackId: app.trackId?.toString() ?? null,
      country: app.country,
      title: app.currentTitle,
      subtitle: app.currentSubtitle,
      description: app.currentDescription,
      rating: snapshot?.rating ?? null,
      ratingsCount: snapshot?.ratingsCount ?? null,
      iconUrl: snapshot?.iconUrl ?? null,
      version: snapshot?.version ?? null,
      developerName: snapshot?.developerName ?? null,
      category: snapshot?.category ?? null,
      reviews: reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        author: r.author,
        territory: r.territory,
        reviewedAt: r.reviewedAt,
      })),
      reviewSummary: latestSummary
        ? {
            id: latestSummary.id,
            reviewCount: latestSummary.reviewCount,
            averageRating: latestSummary.averageRating,
            summary: latestSummary.summary,
            strengths: latestSummary.strengths,
            weaknesses: latestSummary.weaknesses,
            topThemes: latestSummary.topThemes,
            sentiment: latestSummary.sentiment,
            createdAt: latestSummary.createdAt,
          }
        : null,
      metadataChanges: metadataChanges.map((c: any) => ({
        id: c.id,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        detectedAt: c.detectedAt,
      })),
      keywordRankings,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

appsRouter.get("/:id/signing", requireAuth, async (req, res) => {
  try {
    const app = await prisma.app.findUnique({
      where: { id: req.params.id },
      select: {
        signingCertP12: true,
        signingProvisioningProfile: true,
        signingTeamId: true,
      },
    });
    if (!app) {
      res.status(404).json({ error: "App not found" });
      return;
    }
    res.json({
      hasCert: !!app.signingCertP12,
      hasProfile: !!app.signingProvisioningProfile,
      teamId: app.signingTeamId ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

appsRouter.put("/:id/signing", requireAuth, async (req, res) => {
  try {
    const { p12Base64, p12Password, profileBase64, teamId } = req.body;
    if (!p12Base64 || !p12Password || !profileBase64) {
      res.status(400).json({
        error: "p12Base64, p12Password, and profileBase64 are required",
      });
      return;
    }
    await prisma.app.update({
      where: { id: req.params.id },
      data: {
        signingCertP12: p12Base64,
        signingCertPassword: p12Password,
        signingProvisioningProfile: profileBase64,
        signingTeamId: teamId ?? null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

appsRouter.delete("/:id/signing", requireAuth, async (req, res) => {
  try {
    await prisma.app.update({
      where: { id: req.params.id },
      data: {
        signingCertP12: null,
        signingCertPassword: null,
        signingProvisioningProfile: null,
        signingTeamId: null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
