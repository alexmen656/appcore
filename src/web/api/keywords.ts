import { Router } from "express";
import { prisma, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";
import { langForCountry } from "../../services/app-store-markets";

export const keywordsRouter = Router();
keywordsRouter.use(requireAuth);

keywordsRouter.get("/", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const activeBundleId =
      (req.query.bundleId as string | undefined) || settings.ascBundleId;

    const ownApp = await prisma.app.findUnique({
      where: { bundleId: activeBundleId },
    });

    const keywords = await prisma.keyword.findMany({
      where: ownApp ? { rankings: { some: { appId: ownApp.id } } } : {},
      include: {
        rankings: {
          where: ownApp ? { appId: ownApp.id } : undefined,
          orderBy: { trackedAt: "desc" },
          take: 1,
        },
        _count: { select: { suggestions: true } },
      },
      orderBy: [{ popularity: "desc" }],
    });

    const result = await Promise.all(
      keywords.map(async (k) => {
        let topCompetitor: { name: string; rank: number } | null = null;
        if (ownApp) {
          const compRanking = await prisma.keywordRanking.findFirst({
            where: {
              keywordId: k.id,
              appId: { not: ownApp.id },
              rank: { not: null },
            },
            orderBy: [{ trackedAt: "desc" }, { rank: "asc" }],
            include: { app: { select: { name: true } } },
          });
          if (compRanking?.rank) {
            topCompetitor = {
              name: compRanking.app.name,
              rank: compRanking.rank,
            };
          }
        }

        const ourRankingCount = ownApp
          ? await prisma.keywordRanking.count({
              where: { keywordId: k.id, appId: ownApp.id },
            })
          : 0;

        return {
          id: k.id,
          term: k.term,
          country: k.country,
          language: k.language,
          popularity: k.popularity,
          difficulty: k.difficulty,
          searchVolume: k.searchVolume,
          ourRank: k.rankings[0]?.rank ?? null,
          topCompetitor,
          trackingCount: ourRankingCount,
          suggestionCount: k._count.suggestions,
          updatedAt: k.updatedAt,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

keywordsRouter.get("/:id/history", async (req, res) => {
  try {
    const keyword = await prisma.keyword.findUnique({
      where: { id: req.params.id },
    });
    if (!keyword) return res.status(404).json({ error: "Not found" });

    const rankings = await prisma.keywordRanking.findMany({
      where: { keywordId: req.params.id },
      include: { app: { select: { name: true, bundleId: true } } },
      orderBy: { trackedAt: "desc" },
      take: 100,
    });

    res.json({
      keyword: {
        id: keyword.id,
        term: keyword.term,
        popularity: keyword.popularity,
        difficulty: keyword.difficulty,
      },
      rankings: rankings.map((r) => ({
        rank: r.rank,
        appName: r.app.name,
        appBundleId: r.app.bundleId,
        country: r.country,
        trackedAt: r.trackedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

keywordsRouter.post("/", async (req, res) => {
  try {
    const { term, country, language, bundleId } = req.body;
    if (!term) return res.status(400).json({ error: "term is required" });
    const normalizedCountry = (country || "de").toLowerCase();
    const normalizedLanguage = language || langForCountry(normalizedCountry);

    const settings = await getEffectiveSettings(req.user!.userId);
    const activeBundleId = bundleId || settings.ascBundleId;

    const keyword = await prisma.keyword.upsert({
      where: { term_country: { term, country: normalizedCountry } },
      create: {
        term,
        country: normalizedCountry,
        language: normalizedLanguage,
      },
      update: {},
    });

    const ownApp = await prisma.app.findUnique({
      where: { bundleId: activeBundleId },
    });

    if (ownApp) {
      await prisma.keywordRanking.create({
        data: {
          keywordId: keyword.id,
          appId: ownApp.id,
          rank: null,
          country: normalizedCountry,
        },
      });
    }

    res.json({ ok: true, keyword });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

keywordsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.keyword.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
