import { Router } from "express";
import type { Request, Response } from "express";
import { prisma, getEffectiveSettings } from "../../config";
import { requireAuth, verifyAppOwnershipByBundleId } from "../auth";
import { bossScheduler } from "../../jobs/boss";
import { QUEUE_NAME as SCRAPE_QUEUE } from "../../jobs/workers/scrape.worker";
import { QUEUE_NAME as ANALYZE_QUEUE } from "../../jobs/workers/analyze.worker";
import { QUEUE_NAME as TRACK_KEYWORDS_QUEUE } from "../../jobs/workers/track-keywords.worker";
import { QUEUE_NAME as DISCOVER_KEYWORDS_QUEUE } from "../../jobs/workers/discover-keywords.worker";
import { QUEUE_NAME as DISCOVER_COMPETITORS_QUEUE } from "../../jobs/workers/discover-competitors.worker";
import { QUEUE_NAME as SYNC_METADATA_QUEUE } from "../../jobs/workers/sync-metadata.worker";
import { QUEUE_NAME as COMPETITOR_INTEL_QUEUE } from "../../jobs/workers/competitor-intel.worker";

export const actionsRouter = Router();
actionsRouter.use(requireAuth);

async function resolveActionApp(req: Request, res: Response) {
  const bundleId = req.body.bundleId as string;
  if (!bundleId) {
    res.status(400).json({ error: "bundleId required" });
    return null;
  }
  return verifyAppOwnershipByBundleId(req, res, bundleId);
}

actionsRouter.post("/scrape", async (req, res) => {
  try {
    const app = await resolveActionApp(req, res);
    if (!app) return;
    await bossScheduler.sendJob(SCRAPE_QUEUE, {
      bundleId: app.bundleId,
      country: app.country,
    });
    res.json({ ok: true, message: `Scrape job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/analyze", async (req, res) => {
  try {
    const app = await resolveActionApp(req, res);
    if (!app) return;
    await bossScheduler.sendJob(ANALYZE_QUEUE, {
      userId: req.user!.userId,
      bundleId: app.bundleId,
    });
    res.json({ ok: true, message: `Analysis job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/sync", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    if (!settings.ascIssuerId || !settings.ascKeyId || !settings.ascPrivateKey) {
      res.status(400).json({
        error: "App Store Connect credentials not configured in Settings.",
      });
      return;
    }
    const app = await resolveActionApp(req, res);
    if (!app) return;
    await bossScheduler.sendJob(SYNC_METADATA_QUEUE, {
      userId: req.user!.userId,
      bundleId: app.bundleId,
    });
    res.json({ ok: true, message: `Metadata sync job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/track-keywords", async (req, res) => {
  try {
    const app = await resolveActionApp(req, res);
    if (!app) return;
    await bossScheduler.sendJob(TRACK_KEYWORDS_QUEUE, {
      userId: req.user!.userId,
      appId: app.id,
      bundleId: app.bundleId,
      country: app.country,
    });
    res.json({ ok: true, message: `Keyword tracking job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/discover-keywords", async (req, res) => {
  try {
    const app = await resolveActionApp(req, res);
    if (!app) return;
    await bossScheduler.sendJob(DISCOVER_KEYWORDS_QUEUE, {
      userId: req.user!.userId,
      bundleId: app.bundleId,
    });
    res.json({ ok: true, message: `Keyword discovery job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/discover-competitors", async (req, res) => {
  try {
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const keywords = await prisma.keyword.findMany({
      where: { rankings: { some: { appId: app.id } } },
      orderBy: { popularity: "desc" },
      take: 10,
    });
    if (keywords.length === 0) {
      res.status(400).json({ error: "No keywords tracked yet. Add keywords first." });
      return;
    }
    await bossScheduler.sendJob(DISCOVER_COMPETITORS_QUEUE, {
      bundleId: app.bundleId,
      country: app.country,
    });
    res.json({ ok: true, message: `Competitor discovery job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/competitor-intel", async (req, res) => {
  try {
    const app = await resolveActionApp(req, res);
    if (!app) return;
    await bossScheduler.sendJob(COMPETITOR_INTEL_QUEUE, {
      userId: req.user!.userId,
      bundleId: app.bundleId,
    });
    res.json({ ok: true, message: `Competitor intel job enqueued for ${app.bundleId}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

