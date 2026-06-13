import { Router } from "express";
import { prisma } from "../../config";
import { bundleAccess } from "../auth";
import { normalizeLanguage } from "../../services/app-store-markets";

export const keywordsRouter = Router();

keywordsRouter.get("/", bundleAccess("query", "bundleId"), async (req, res) => {
  try {
    const ownApp = req.bundleApp!;
    const t0 = performance.now();

    type KeywordPageRow = {
      id: string;
      term: string;
      country: string;
      language: string;
      popularity: number | null;
      difficulty: number | null;
      searchVolume: number | null;
      updatedAt: Date;
      latestRank: number | null;
    };
    const [pageRows, total] = await Promise.all([
      prisma.$queryRaw<KeywordPageRow[]>`
        WITH app_keyword_ids AS MATERIALIZED (
          SELECT DISTINCT "keywordId" AS id
          FROM "KeywordRanking"
          WHERE "appId" = ${ownApp.id}
        ),
        page AS (
          SELECT k.id, k.term, k.country, k.language, k.popularity, k.difficulty,
                 k."searchVolume", k."updatedAt"
          FROM "Keyword" k
          JOIN app_keyword_ids ak ON ak.id = k.id
          ORDER BY k.popularity DESC NULLS LAST
        )
        SELECT p.id, p.term, p.country, p.language, p.popularity, p.difficulty,
               p."searchVolume", p."updatedAt",
               lr.rank AS "latestRank"
        FROM page p
        LEFT JOIN LATERAL (
          SELECT rank
          FROM "KeywordRanking"
          WHERE "appId" = ${ownApp.id} AND "keywordId" = p.id
          ORDER BY "trackedAt" DESC
          LIMIT 1
        ) lr ON TRUE
        ORDER BY p.popularity DESC NULLS LAST
      `,
      prisma.keyword.count({ where: { rankings: { some: { appId: ownApp.id } } } }),
    ]);
    const t1 = performance.now();

    const keywords = pageRows.map((r) => ({
      id: r.id,
      term: r.term,
      country: r.country,
      language: r.language,
      popularity: r.popularity,
      difficulty: r.difficulty,
      searchVolume: r.searchVolume,
      updatedAt: r.updatedAt,
      rankings: r.latestRank != null ? [{ rank: r.latestRank }] : ([] as { rank: number | null }[]),
    }));
    const keywordIds = keywords.map((k) => k.id);

    if (keywordIds.length === 0) {
      res.json({ items: [], total });
      return;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    type CompRow = {
      keywordId: string;
      appId: string;
      rank: number;
      appName: string;
      iconUrl: string | null;
    };
    type CountRow = { keywordId: string; _count: { id: number } };
    type PrevRow = { keywordId: string; rank: number | null };

    const time = async <T>(label: string, p: Promise<T>): Promise<[T, number]> => {
      const s = performance.now();
      const v = await p;
      return [v, performance.now() - s];
    };
    const [[topCompRows, tComp], [ourRankingCounts, tCount], [previousRankings, tPrev]] = await Promise.all([
      time(
        "comp",
        prisma.$queryRaw<CompRow[]>`
        SELECT t."keywordId", t."appId", t.rank,
               a.name AS "appName",
               li."iconUrl"
        FROM "KeywordTopApp" t
        JOIN "App" a ON a.id = t."appId"
        LEFT JOIN LATERAL (
          SELECT "iconUrl"
          FROM "AppSnapshot"
          WHERE "appId" = t."appId"
          ORDER BY "scrapedAt" DESC
          LIMIT 1
        ) li ON TRUE
        WHERE t."keywordId" = ANY(${keywordIds}::text[])
        ORDER BY t."keywordId", t.rank ASC
      `,
      ),
      time(
        "count",
        prisma.keywordRanking.groupBy({
          by: ["keywordId"],
          where: { keywordId: { in: keywordIds }, appId: ownApp.id },
          _count: { id: true },
        }),
      ),
      time(
        "prev",
        prisma.$queryRaw<PrevRow[]>`
        SELECT DISTINCT ON ("keywordId") "keywordId", rank
        FROM "KeywordRanking"
        WHERE "keywordId" = ANY(${keywordIds}::text[])
          AND "appId" = ${ownApp.id}
          AND "trackedAt" <= ${oneDayAgo}
        ORDER BY "keywordId", "trackedAt" DESC
      `,
      ),
    ]);

    const topCompetitorsMap = new Map<string, CompRow[]>();
    for (const r of topCompRows) {
      const list = topCompetitorsMap.get(r.keywordId) ?? [];
      list.push(r);
      topCompetitorsMap.set(r.keywordId, list);
    }

    const previousRankMap = new Map(previousRankings.map((r) => [r.keywordId, r.rank]));
    const countMap = new Map(ourRankingCounts.map((r) => [r.keywordId, r._count.id]));
    const result = keywords.map((k) => {
      const list = topCompetitorsMap.get(k.id) ?? [];
      const topCompetitors = list.map((r) => ({
        name: r.appName,
        iconUrl: r.iconUrl,
        rank: r.rank,
      }));

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
        suggestionCount: 0,
        updatedAt: k.updatedAt,
      };
    });

    const tTotal = performance.now() - t0;
    res.setHeader(
      "Server-Timing",
      `keywords;dur=${(t1 - t0).toFixed(0)},comp;dur=${tComp.toFixed(0)},count;dur=${tCount.toFixed(0)},prev;dur=${tPrev.toFixed(0)},total;dur=${tTotal.toFixed(0)}`,
    );
    console.log(
      `[keywords] n=${keywords.length} keywords=${(t1 - t0).toFixed(0)}ms comp=${tComp.toFixed(0)}ms count=${tCount.toFixed(0)}ms prev=${tPrev.toFixed(0)}ms total=${tTotal.toFixed(0)}ms`,
    );
    res.json({ items: result, total });
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

keywordsRouter.post("/", bundleAccess("body", "bundleId"), async (req, res) => {
  try {
    const { term, country, language } = req.body;
    if (!term) return res.status(400).json({ error: "term is required" });
    const normalizedCountry = (country || "de").toLowerCase();
    const normalizedLanguage = normalizeLanguage(language, normalizedCountry);
    const ownApp = req.bundleApp!;

    const keyword = await prisma.keyword.upsert({
      where: { term_country: { term, country: normalizedCountry } },
      create: {
        term,
        country: normalizedCountry,
        language: normalizedLanguage,
      },
      update: {},
    });

    await prisma.keywordRanking.create({
      data: {
        keywordId: keyword.id,
        appId: ownApp.id,
        rank: null,
        country: normalizedCountry,
      },
    });

    res.json({ ok: true, keyword });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

keywordsRouter.delete("/:id", async (req, res) => {
  try {
    if (req.user!.role !== "ADMIN") {
      const teamId = req.user!.teamId;
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
