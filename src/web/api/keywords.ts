import { Router } from "express";
import { prisma } from "../../config";
import { requireAuth } from "../auth";
import { normalizeLanguage } from "../../services/app-store-markets";

export const keywordsRouter = Router();
keywordsRouter.use(requireAuth);

keywordsRouter.get("/", async (req, res) => {
  try {
    const activeBundleId = req.query.bundleId as string | undefined;

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

    const keywordIds = keywords.map((k) => k.id);

    type CompRanking = Awaited<
      ReturnType<
        typeof prisma.keywordRanking.findMany<{
          include: {
            app: {
              select: {
                name: true;
                snapshots: {
                  select: { iconUrl: true };
                  orderBy: { scrapedAt: "desc" };
                  take: 1;
                };
              };
            };
          };
        }>
      >
    >[number];
    type CountRow = { keywordId: string; _count: { id: number } };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let topCompRankings: CompRanking[] = [];
    let ourRankingCounts: CountRow[] = [];
    let previousRankings: { keywordId: string; rank: number | null }[] = [];

    if (ownApp) {
      [topCompRankings, ourRankingCounts, previousRankings] = await Promise.all([
        prisma.keywordRanking.findMany({
          where: {
            keywordId: { in: keywordIds },
            rank: { not: null },
          },
          orderBy: [{ trackedAt: "desc" }],
          include: {
            app: {
              select: {
                name: true,
                snapshots: {
                  select: { iconUrl: true },
                  orderBy: { scrapedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
          distinct: ["keywordId", "appId"],
        }),
        prisma.keywordRanking.groupBy({
          by: ["keywordId"],
          where: { keywordId: { in: keywordIds }, appId: ownApp.id },
          _count: { id: true },
        }),
        prisma.keywordRanking.findMany({
          where: {
            keywordId: { in: keywordIds },
            appId: ownApp.id,
            trackedAt: { lte: oneDayAgo },
          },
          orderBy: { trackedAt: "desc" },
          distinct: ["keywordId"],
          select: { keywordId: true, rank: true },
        }),
      ]);
    }

    const topCompetitorsMap = new Map<string, CompRanking[]>();
    for (const r of topCompRankings) {
      const list = topCompetitorsMap.get(r.keywordId) ?? [];
      list.push(r);
      topCompetitorsMap.set(r.keywordId, list);
    }
    for (const list of topCompetitorsMap.values()) {
      list.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    }

    const previousRankMap = new Map(previousRankings.map((r) => [r.keywordId, r.rank]));
    const countMap = new Map(ourRankingCounts.map((r) => [r.keywordId, r._count.id]));

    const result = keywords.map((k) => {
      // Old single-top-competitor logic — kept for reference, replaced by topCompetitors below.
      // let topCompetitor: { name: string; rank: number } | null = null;
      // if (ownApp) {
      //   const compRanking = topCompMap.get(k.id);
      //   if (compRanking?.rank) {
      //     topCompetitor = {
      //       name: compRanking.app.name,
      //       rank: compRanking.rank,
      //     };
      //   }
      // }

      let topCompetitors: { name: string; iconUrl: string | null; rank: number }[] = [];
      if (ownApp) {
        const list = topCompetitorsMap.get(k.id) ?? [];
        topCompetitors = list.slice(0, 5).map((r) => ({
          name: r.app.name,
          iconUrl: r.app.snapshots[0]?.iconUrl ?? null,
          rank: r.rank!,
        }));
      }

      const ourRankingCount = countMap.get(k.id) ?? 0;

      const currentRank = k.rankings[0]?.rank ?? null;
      const previousRank = previousRankMap.get(k.id) ?? null;
      const rankTrend = currentRank != null && previousRank != null ? previousRank - currentRank : null;

      return {
        id: k.id,
        term: k.term,
        country: k.country,
        language: k.language,
        popularity: k.popularity,
        difficulty: k.difficulty,
        searchVolume: k.searchVolume,
        ourRank: currentRank,
        rankTrend,
        topCompetitors,
        trackingCount: ourRankingCount,
        suggestionCount: k._count.suggestions,
        updatedAt: k.updatedAt,
      };
    });

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
    const normalizedLanguage = normalizeLanguage(language, normalizedCountry);

    const activeBundleId = bundleId;

    const keyword = await prisma.keyword.upsert({
      where: { term_country: { term, country: normalizedCountry } },
      create: {
        term,
        country: normalizedCountry,
        language: normalizedLanguage,
      },
      update: {},
    });

    const ownApp = activeBundleId ? await prisma.app.findUnique({ where: { bundleId: activeBundleId } }) : null;

    if (ownApp) {
      const isAdmin = req.user!.role === "ADMIN";
      if (!isAdmin && (!ownApp.teamId || ownApp.teamId !== req.user!.teamId)) {
        res.status(403).json({ error: "Not authorized to add keywords to this app" });
        return;
      }

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
    if (req.user!.role !== "ADMIN") {
      const teamId = req.user!.teamId;
      if (!teamId) {
        res.status(403).json({ error: "No team" });
        return;
      }

      const ranking = await prisma.keywordRanking.findFirst({
        where: {
          keywordId: req.params.id,
          app: { teamId },
        },
      });
      if (!ranking) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }
    }

    await prisma.keyword.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
