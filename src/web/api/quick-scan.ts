import { type Request, type Response } from "express";
import { prisma } from "../../config";
import { evaluateAppMetadata } from "./quick-scan-ai";

type Impact = "high" | "med";

type Finding = {
  key: string;
  title: string;
  desc: string;
  impact: Impact;
  gap: number;
  metric: [string, string];
};

const MAX_FINDINGS = 4;

export async function runQuickScan(req: Request, res: Response): Promise<void> {
  const bundleId = req.query.bundleId as string;

  const app = await prisma.app.findUnique({
    where: { bundleId },
    include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
  });
  const snapshot = app?.snapshots[0] ?? null;

  if (!app || !snapshot) {
    res.json({ ready: false });
    return;
  }

  const appId = app.id;
  const [distinctKeywords, competitorCount] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "keywordId")::int AS count
        FROM "KeywordRanking"
        WHERE "appId" = ${appId}
      `.then(([r]) => Number(r.count)),
    prisma.competitorRelation.count({
      where: { OR: [{ appId }, { competitorId: appId }] },
    }),
  ]);

  const title = (app.currentTitle ?? snapshot.title ?? "").trim();
  const subtitle = (app.currentSubtitle ?? snapshot.subtitle ?? "").trim();
  const screenshots = snapshot.screenshotUrls?.length ?? 0;
  const wordCount = snapshot.wordCount ?? 0;
  const rating = snapshot.rating ?? null;
  const pool: Finding[] = [];

  if (!subtitle) {
    pool.push({
      key: "subtitle",
      title: "Add a subtitle",
      desc: "No subtitle is set - that's 30 prime characters for keywords and your pitch going unused.",
      impact: "high",
      metric: ["0", "/ 30 chars"],
      gap: 1,
    });
  } else if (subtitle.length < 28) {
    pool.push({
      key: "subtitle",
      title: "Use your full subtitle",
      desc: `Your subtitle uses ${subtitle.length} of 30 characters - claim the rest for high-value keywords.`,
      impact: "med",
      metric: [String(subtitle.length), "/ 30 chars"],
      gap: (30 - subtitle.length) / 30,
    });
  }

  if (title && title.length < 28) {
    pool.push({
      key: "title",
      title: "Optimize your title",
      desc: `Your title uses ${title.length} of 30 characters - easy keyword space to claim.`,
      impact: title.length < 18 ? "high" : "med",
      metric: [String(title.length), "/ 30 chars"],
      gap: (30 - title.length) / 30,
    });
  }

  if (screenshots < 10) {
    pool.push({
      key: "screenshots",
      title: "Add more screenshots",
      desc: `You have ${screenshots} screenshot${screenshots === 1 ? "" : "s"}. Up to 10 gives you more room to convert browsers.`,
      impact: screenshots < 4 ? "high" : "med",
      metric: [String(screenshots), "/ 10"],
      gap: (10 - screenshots) / 10,
    });
  }

  if (distinctKeywords < 25) {
    pool.push({
      key: "keyword",
      title: "Expand keyword coverage",
      desc:
        distinctKeywords === 0
          ? "We haven't found ranked keywords yet - start tracking terms to show up in more searches."
          : `You rank for ${distinctKeywords} keyword${distinctKeywords === 1 ? "" : "s"}. Top apps cover dozens - lots of room to reach more searchers.`,
      impact: "high",
      metric: [String(distinctKeywords), "tracked"],
      gap: (25 - distinctKeywords) / 25,
    });
  }

  if (competitorCount < 3) {
    pool.push({
      key: "competitor",
      title: "Benchmark competitors",
      desc:
        competitorCount === 0
          ? "No competitors identified yet - add rivals to see which keywords they win."
          : `Only ${competitorCount} competitor${competitorCount === 1 ? "" : "s"} tracked - add more to spot winnable terms.`,
      impact: "med",
      metric: [String(competitorCount), "tracked"],
      gap: (3 - competitorCount) / 3,
    });
  }

  if (wordCount < 120) {
    pool.push({
      key: "description",
      title: "Enrich your description",
      desc: `Your description is ${wordCount} word${wordCount === 1 ? "" : "s"}. Fuller descriptions convert better and give the algorithm more context.`,
      impact: "med",
      metric: [String(wordCount), "words"],
      gap: Math.min(1, (120 - wordCount) / 120),
    });
  }

  const findings = pool
    .sort((a, b) => b.gap - a.gap)
    .slice(0, MAX_FINDINGS)
    .map(({ gap: _gap, ...f }) => f);

  const mTitle = title ? Math.min(title.length / 30, 1) : 0;
  const mSub = subtitle ? Math.min(subtitle.length / 30, 1) : 0;
  const mShots = Math.min(screenshots / 8, 1);
  const mDesc = Math.min(wordCount / 120, 1);
  const metaScore = mTitle * 0.25 + mSub * 0.3 + mShots * 0.3 + mDesc * 0.15;
  const kwScore = Math.min(distinctKeywords / 25, 1);
  const compScore = Math.min(competitorCount / 5, 1);
  const ratingScore = rating != null ? Math.min(rating / 5, 1) : 0.6;
  const score = Math.round(100 * (metaScore * 0.5 + kwScore * 0.25 + compScore * 0.15 + ratingScore * 0.1));
  const target = Math.min(94, score + 30);

  const ai = await evaluateAppMetadata(appId, {
    title,
    subtitle,
    keywords: app.currentKeywords ?? "",
    description: app.currentDescription ?? snapshot.description ?? "",
  });

  res.json({
    ready: true,
    app: {
      name: app.name,
      iconUrl: snapshot.iconUrl ?? null,
      rating,
      ratingsCount: snapshot.ratingsCount ?? null,
      category: snapshot.category ?? null,
    },
    score,
    target,
    findings,
    ai,
  });
}
