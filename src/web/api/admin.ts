import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config";
import { requireAuth } from "../auth";

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const router = Router();

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }
  next();
}

router.use(requireAuth);
router.use(requireSuperAdmin);

type PrismaDelegate = {
  findMany: (args: any) => Promise<any[]>;
  count: (args?: any) => Promise<number>;
  findUnique: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

function getModel(name: string): PrismaDelegate | null {
  const models: Record<string, PrismaDelegate> = {
    user: prisma.user,
    team: prisma.team,
    teamMember: prisma.teamMember,
    teamInvite: prisma.teamInvite,
    teamSettings: prisma.teamSettings,
    app: prisma.app,
    appSnapshot: prisma.appSnapshot,
    keyword: prisma.keyword,
    keywordRanking: prisma.keywordRanking,
    asoSuggestion: prisma.aSOSuggestion,
    asoExperiment: prisma.asoExperiment,
    competitorRelation: prisma.competitorRelation,
    appStoreAnalytics: prisma.appStoreAnalytics,
    appReview: prisma.appReview,
    competitorReview: prisma.competitorReview,
    competitorReviewSummary: prisma.competitorReviewSummary,
    appMetadataChange: prisma.appMetadataChange,
    screenshotJob: prisma.screenshotJob,
    buildJob: prisma.buildJob,
    oauthClient: prisma.oAuthClient,
    deviceToken: prisma.deviceToken,
    pushNotificationLog: prisma.pushNotificationLog,
    passkeyCredential: prisma.passkeyCredential,
    ascRateLimit: prisma.ascRateLimit,
  };
  return models[name] ?? null;
}

const searchFields: Record<string, string[]> = {
  user: ["email", "name"],
  team: ["name"],
  teamMember: ["teamId", "userId"],
  teamInvite: ["email"],
  teamSettings: ["teamId"],
  app: ["bundleId", "name", "currentTitle"],
  appSnapshot: ["title", "subtitle", "developerName"],
  keyword: ["term"],
  keywordRanking: ["keywordId", "appId"],
  asoSuggestion: ["appBundleId", "aiProvider", "aiModel"],
  asoExperiment: ["appId"],
  competitorRelation: ["appId", "competitorId"],
  appStoreAnalytics: ["bundleId", "country"],
  appReview: ["bundleId", "title", "reviewerNickname"],
  competitorReview: ["appId", "title", "author"],
  competitorReviewSummary: ["appId", "sentiment"],
  appMetadataChange: ["appId", "field"],
  screenshotJob: ["appId", "commitSha", "branch"],
  buildJob: ["appId", "branch", "commitSha"],
  oauthClient: ["name", "clientId"],
  deviceToken: ["token", "userId", "bundleId"],
  pushNotificationLog: ["title", "deviceToken"],
  passkeyCredential: ["userId", "name"],
};

router.get("/dashboard", async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    users,
    teams,
    apps,
    keywords,
    suggestions,
    reviews,
    screenshotJobs,
    buildJobs,
    oauthClients,
    deviceTokens,
    analytics,
    recentUsers,
    recentApps,
    jobStatusCounts,
    suggestionTypeCounts,
    rateLimits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.app.count(),
    prisma.keyword.count(),
    prisma.aSOSuggestion.count(),
    prisma.appReview.count(),
    prisma.screenshotJob.count(),
    prisma.buildJob.count(),
    prisma.oAuthClient.count(),
    prisma.deviceToken.count(),
    prisma.appStoreAnalytics.count(),
    prisma.$queryRaw<{ day: Date; count: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*)::int as count
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY day ORDER BY day ASC
    `,
    prisma.$queryRaw<{ day: Date; count: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*)::int as count
      FROM "App"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY day ORDER BY day ASC
    `,
    prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status::text, COUNT(*)::int as count FROM "ScreenshotJob" GROUP BY status
      UNION ALL
      SELECT CONCAT('build_', status::text), COUNT(*)::int FROM "BuildJob" GROUP BY status
    `,
    prisma.$queryRaw<{ type: string; count: number }[]>`
      SELECT type::text, COUNT(*)::int as count FROM "ASOSuggestion" GROUP BY type ORDER BY count DESC
    `,
    prisma.$queryRaw<{ teamId: string; teamName: string; hourLimit: number; hourRemaining: number; updatedAt: Date }[]>`
      SELECT r."teamId", COALESCE(t.name, r."teamId") as "teamName",
             r."hourLimit", r."hourRemaining", r."updatedAt"
      FROM "AscRateLimit" r
      LEFT JOIN "Team" t ON t.id = r."teamId"
      ORDER BY r."hourRemaining" ASC
    `,
  ]);

  const toChartData = (rows: { day: Date | string; count: number }[]) =>
    rows.map((r) => ({
      date: (r.day instanceof Date ? r.day : new Date(r.day as string)).toISOString().split("T")[0],
      count: Number(r.count),
    }));

  res.json({
    users,
    teams,
    apps,
    keywords,
    suggestions,
    reviews,
    screenshotJobs,
    buildJobs,
    oauthClients,
    deviceTokens,
    analytics,
    ascRateLimits: rateLimits.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName,
      hourLimit: Number(r.hourLimit),
      hourRemaining: Number(r.hourRemaining),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    })),
    charts: {
      usersOverTime: toChartData(recentUsers),
      appsOverTime: toChartData(recentApps),
      jobStatus: jobStatusCounts.map((r) => ({
        status: r.status,
        count: Number(r.count),
      })),
      suggestionTypes: suggestionTypeCounts.map((r) => ({
        type: r.type,
        count: Number(r.count),
      })),
    },
  });
});

const VALID_QUEUES = [
  "scrape",
  "track-keywords",
  "sync-analytics",
  "extract-keywords",
  "discover-keywords",
  "discover-competitors",
  "analyze",
  "sync-metadata",
  "competitor-intel",
];

router.get("/boss/jobs", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const queue = typeof req.query.queue === "string" ? req.query.queue : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    let sql = `
      SELECT id::text, name, state::text, data, output,
             retry_count, created_on, started_on, completed_on
      FROM pgboss.job
      WHERE name NOT LIKE '%/dispatch'
    `;
    const params: any[] = [];

    if (queue && VALID_QUEUES.includes(queue)) {
      params.push(queue);
      sql += ` AND name = $${params.length}`;
    }
    if (state) {
      params.push(state);
      sql += ` AND state::text = $${params.length}`;
    }
    sql += ` ORDER BY created_on DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (err: any) {
    const code = err?.meta?.driverAdapterError?.cause?.originalCode;
    if (code === "42P01" || code === "3F000") return res.json([]);
    res.status(500).json({ error: "Failed to query pg-boss jobs" });
  }
});

router.get("/boss/queues", async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<{ name: string; created_on: Date }[]>`
      SELECT name, created_on FROM pgboss.queue ORDER BY name ASC
    `;
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.get("/boss/schedules", async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<{ name: string; cron: string; timezone: string; updated_on: Date }[]>`
      SELECT name, cron, timezone, updated_on FROM pgboss.schedule ORDER BY name ASC
    `;
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.get("/boss/stats", async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<{ name: string; state: string; count: number }[]>`
      SELECT name, state::text, COUNT(*)::int as count
      FROM pgboss.job
      WHERE name NOT LIKE '%/dispatch'
      GROUP BY name, state
      ORDER BY name, state
    `;
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.get("/:model", async (req: Request, res: Response) => {
  const modelName = req.params.model as string;
  const delegate = getModel(modelName);
  if (!delegate) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const skip = (page - 1) * pageSize;

  let where: any = {};
  if (search && searchFields[modelName]) {
    where = {
      OR: searchFields[modelName].map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      })),
    };
  }

  const [data, total] = await Promise.all([
    delegate
      .findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } })
      .catch(() => delegate.findMany({ where, skip, take: pageSize })),
    delegate.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.get("/:model/:id", async (req: Request, res: Response) => {
  const delegate = getModel(req.params.model as string);
  if (!delegate) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const record = await delegate.findUnique({
    where: { id: req.params.id as string },
  });
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(record);
});

router.post("/:model", async (req: Request, res: Response) => {
  const delegate = getModel(req.params.model as string);
  if (!delegate) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const record = await delegate.create({ data: req.body });
  res.status(201).json(record);
});

router.put("/:model/:id", async (req: Request, res: Response) => {
  const delegate = getModel(req.params.model as string);
  if (!delegate) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const record = await delegate.update({
    where: { id: req.params.id as string },
    data: req.body,
  });
  res.json(record);
});

router.delete("/:model/:id", async (req: Request, res: Response) => {
  const delegate = getModel(req.params.model as string);
  if (!delegate) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  await delegate.delete({ where: { id: req.params.id as string } });
  res.json({ ok: true });
});

export { router as adminRouter };
