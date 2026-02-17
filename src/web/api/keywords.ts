import { Router } from "express";
import { prisma } from "../../config";

export const keywordsRouter = Router();

// List all keywords with latest ranking
keywordsRouter.get("/", async (req, res) => {
  try {
    const keywords = await prisma.keyword.findMany({
      include: {
        rankings: {
          orderBy: { trackedAt: "desc" },
          take: 1,
        },
        _count: { select: { rankings: true, suggestions: true } },
      },
      orderBy: [{ popularity: "desc" }],
    });

    res.json(
      keywords.map((k) => ({
        id: k.id,
        term: k.term,
        country: k.country,
        language: k.language,
        popularity: k.popularity,
        difficulty: k.difficulty,
        searchVolume: k.searchVolume,
        latestRank: k.rankings[0]?.rank ?? null,
        rankingCount: k._count.rankings,
        suggestionCount: k._count.suggestions,
        updatedAt: k.updatedAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get keyword ranking history
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

// Add a keyword to track
keywordsRouter.post("/", async (req, res) => {
  try {
    const { term, country, language } = req.body;
    if (!term) return res.status(400).json({ error: "term is required" });

    const keyword = await prisma.keyword.upsert({
      where: { term_country: { term, country: country || "de" } },
      create: {
        term,
        country: country || "de",
        language: language || "de",
      },
      update: {},
    });

    res.json({ ok: true, keyword });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete a keyword
keywordsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.keyword.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
