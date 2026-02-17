import { Router } from "express";
import { prisma, logger, env } from "../../config";

export const actionsRouter = Router();

// Trigger a competitor scrape
actionsRouter.post("/scrape", async (_req, res) => {
  try {
    const { AppStoreScraper } = await import("../../services/appstore-scraper");
    const scraper = new AppStoreScraper();

    // Run in background, return immediately
    res.json({ ok: true, message: "Scrape job started" });

    scraper
      .runFullScrapeJob()
      .then(() => logger.info("Web-triggered scrape completed"))
      .catch((err) => logger.error("Web-triggered scrape failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Trigger AI analysis
actionsRouter.post("/analyze", async (req, res) => {
  try {
    const { ASOAnalyzer } = await import("../../services/ai-analyzer");
    const analyzer = new ASOAnalyzer();
    const locales = req.body.locales || env.ASO_LOCALES.split(",");

    res.json({ ok: true, message: `Analysis started for locales: ${locales.join(", ")}` });

    analyzer
      .analyzeAndSuggest(locales)
      .then(() => logger.info("Web-triggered analysis completed"))
      .catch((err) => logger.error("Web-triggered analysis failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Trigger ASC sync
actionsRouter.post("/sync", async (_req, res) => {
  try {
    const { AppStoreConnectClient } = await import(
      "../../services/appstore-connect"
    );
    const asc = new AppStoreConnectClient();
    const locales = env.ASO_LOCALES.split(",");
    const results: Record<string, any> = {};

    for (const locale of locales) {
      const state = await asc.getCurrentASOState(locale);
      results[locale] = state;
    }

    // Update our local DB with the synced data (use first locale as primary)
    const primaryState = results[locales[0]];
    if (primaryState) {
      await prisma.app.upsert({
        where: { bundleId: env.ASC_BUNDLE_ID },
        create: {
          bundleId: env.ASC_BUNDLE_ID,
          name: primaryState.name || "Kalbuddy",
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

// Trigger keyword tracking
actionsRouter.post("/track-keywords", async (_req, res) => {
  try {
    const { KeywordTracker } = await import("../../services/keyword-tracker");
    const tracker = new KeywordTracker();

    res.json({ ok: true, message: "Keyword tracking started" });

    tracker
      .trackAllKeywords()
      .then(() => logger.info("Web-triggered keyword tracking completed"))
      .catch((err) => logger.error("Web-triggered keyword tracking failed", err));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get job history
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
