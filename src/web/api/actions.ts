import { Router } from "express";
import { prisma, logger, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const actionsRouter = Router();
actionsRouter.use(requireAuth);

actionsRouter.post("/scrape", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const { AppStoreScraper } = await import("../../services/appstore-scraper");
    const scraper = new AppStoreScraper(settings);

    res.json({ ok: true, message: "Scrape job started" });

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
    const { AIAnalyzer } = await import("../../services/ai-analyzer");
    const analyzer = new AIAnalyzer(settings);
    const locales: string[] = req.body.locales || settings.asoLocales;

    res.json({
      ok: true,
      message: `Analysis started for locales: ${locales.join(", ")}`,
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

    if (!settings.ascIssuerId || !settings.ascKeyId || !settings.ascPrivateKey) {
      res.status(400).json({ error: "App Store Connect credentials not configured in Settings." });
      return;
    }

    const { AppStoreConnectClient } = await import("../../services/appstore-connect");
    const asc = new AppStoreConnectClient({
      issuerId: settings.ascIssuerId,
      keyId: settings.ascKeyId,
      privateKey: settings.ascPrivateKey,
    });

    const locales = settings.asoLocales;
    const results: Record<string, any> = {};

    for (const locale of locales) {
      const state = await asc.getCurrentASOState(locale);
      results[locale] = state;
    }

    const primaryState = results[locales[0]];
    if (primaryState && settings.ascBundleId) {
      await prisma.app.upsert({
        where: { bundleId: settings.ascBundleId },
        create: {
          bundleId: settings.ascBundleId,
          name: primaryState.name || "App",
          isOwnApp: true,
          currentTitle: primaryState.name,
          currentSubtitle: primaryState.subtitle,
          currentKeywords: primaryState.keywords,
          currentDescription: primaryState.description,
        },
        update: {
          currentTitle: primaryState.name,
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
    const { KeywordTracker } = await import("../../services/keyword-tracker");
    const tracker = new KeywordTracker(settings);

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
    const { KeywordDiscoveryAgent } = await import(
      "../../services/keyword-discovery-agent"
    );
    const agent = new KeywordDiscoveryAgent(settings);

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

