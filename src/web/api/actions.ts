import { Router } from "express";
import type { Request, Response } from "express";
import { prisma, logger, getEffectiveSettings } from "../../config";
import { requireAuth, verifyAppOwnershipByBundleId } from "../auth";

export const actionsRouter = Router();
actionsRouter.use(requireAuth);

async function resolveActionApp(
  req: Request,
  res: Response,
) {
  const bundleId = req.body.bundleId as string;
  if (!bundleId) {
    res.status(400).json({ error: "bundleId required" });
    return null;
  }
  return verifyAppOwnershipByBundleId(req, res, bundleId);
}

actionsRouter.post("/scrape", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const { AppStoreScraper } = await import("../../services/appstore-scraper");
    const scraper = new AppStoreScraper(app.country, undefined, app.bundleId);

    res.json({ ok: true, message: `Scrape job started for ${app.bundleId}` });

    scraper
      .runFullScrapeJob()
      .then(() => logger.info("Web-triggered scrape completed"))
      .catch((err) => logger.error("Web-triggered scrape failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/analyze", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const { AIAnalyzer } = await import("../../services/ai-analyzer");
    const analyzer = new AIAnalyzer(app.bundleId, settings);
    const locales: string[] = req.body.locales || ["en-US"];

    res.json({
      ok: true,
      message: `Analysis started for ${app.bundleId}, locales: ${locales.join(", ")}`,
    });

    analyzer
      .analyzeAndSuggest(locales)
      .then(() => logger.info("Web-triggered analysis completed"))
      .catch((err) => logger.error("Web-triggered analysis failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/sync", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);

    if (
      !settings.ascIssuerId ||
      !settings.ascKeyId ||
      !settings.ascPrivateKey
    ) {
      res.status(400).json({
        error: "App Store Connect credentials not configured in Settings.",
      });
      return;
    }

    const app = await resolveActionApp(req, res);
    if (!app) return;

    const { AppStoreConnectClient } =
      await import("../../services/appstore-connect");
    const asc = new AppStoreConnectClient({
      issuerId: settings.ascIssuerId,
      keyId: settings.ascKeyId,
      privateKey: settings.ascPrivateKey,
    });

    const ascApp = await asc.getApp(app.bundleId).catch(() => null);
    const availableLocalizations = ascApp
      ? await asc.getAppInfoLocalizations(ascApp.id).catch(() => [])
      : [];
    const locales =
      availableLocalizations.length > 0
        ? availableLocalizations
            .map((l: any) => l.attributes?.locale ?? l.locale)
            .filter(Boolean)
        : ["en-US"];
    const results: Record<string, any> = {};

    for (const locale of locales) {
      const state = await asc.getCurrentASOState(locale);
      results[locale] = state;
    }

    const primaryState = results[locales[0]];

    if (primaryState) {
      await prisma.app.update({
        where: { bundleId: app.bundleId },
        data: {
          currentTitle: primaryState.title,
          currentSubtitle: primaryState.subtitle,
          currentKeywords: primaryState.keywords,
          currentDescription: primaryState.description,
        },
      });
    }

    res.json({ ok: true, locales: results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/track-keywords", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const { KeywordTracker } = await import("../../services/keyword-tracker");
    const tracker = new KeywordTracker(app.bundleId, app.country, settings);

    res.json({ ok: true, message: "Keyword tracking started" });

    tracker
      .trackAllKeywords()
      .then(() => logger.info("Web-triggered keyword tracking completed"))
      .catch((err) =>
        logger.error("Web-triggered keyword tracking failed", err),
      );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/discover-keywords", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const { KeywordDiscoveryAgent } =
      await import("../../services/keyword-discovery-agent");
    const agent = new KeywordDiscoveryAgent(app.bundleId, settings);

    res.json({ ok: true, message: "Keyword discovery started" });

    agent
      .run()
      .then((result) =>
        logger.info("Web-triggered keyword discovery completed", result),
      )
      .catch((err) =>
        logger.error("Web-triggered keyword discovery failed", err),
      );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/discover-competitors", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const { AppStoreScraper } = await import("../../services/appstore-scraper");
    const scraper = new AppStoreScraper(app.country);

    const keywords = await prisma.keyword.findMany({
      where: { rankings: { some: { appId: app.id } } },
      orderBy: { popularity: "desc" },
      take: 10,
    });
    const searchTerms = keywords.map((k) => k.term);

    if (searchTerms.length === 0) {
      res
        .status(400)
        .json({ error: "No keywords tracked yet. Add keywords first." });
      return;
    }

    res.json({ ok: true, message: "Competitor discovery started" });

    scraper
      .discoverCompetitors(searchTerms, app.bundleId, 100)
      .then((ids) =>
        logger.info(`Web-triggered competitor discovery: ${ids.length} found`),
      )
      .catch((err) =>
        logger.error("Web-triggered competitor discovery failed", err),
      );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.get("/jobs", async (_req, res) => {
  try {
    const jobs = await prisma.scrapeJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

actionsRouter.post("/competitor-intel", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const app = await resolveActionApp(req, res);
    if (!app) return;
    const { CompetitorIntelService } =
      await import("../../services/competitor-intel");
    const intel = new CompetitorIntelService(settings);

    res.json({
      ok: true,
      message: "Competitor intelligence gathering started",
    });

    intel
      .runFullIntelJob(app.bundleId)
      .then((result) => logger.info("Competitor intel completed", result))
      .catch((err) => logger.error("Competitor intel failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
