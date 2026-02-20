import { Router } from "express";
import { prisma } from "../../config";
import { requireAuth } from "../auth";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// ─── GET /api/settings ───────────────────────────────────────────────────────
settingsRouter.get("/", async (req, res) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.userId },
    });

    res.json(
      settings
        ? {
            ascIssuerId: settings.ascIssuerId ?? "",
            ascKeyId: settings.ascKeyId ?? "",
            ascPrivateKey: settings.ascPrivateKey ? "••••••••" : "",
            ascPrivateKeySet: !!settings.ascPrivateKey,
            ascAppId: settings.ascAppId ?? "",
            ascBundleId: settings.ascBundleId ?? "",
            ascVendorNumber: settings.ascVendorNumber ?? "",
            openaiApiKey: settings.openaiApiKey ? "••••••••" : "",
            openaiApiKeySet: !!settings.openaiApiKey,
            anthropicApiKey: settings.anthropicApiKey ? "••••••••" : "",
            anthropicApiKeySet: !!settings.anthropicApiKey,
            aiProvider: settings.aiProvider ?? "openai",
            scrapeCountry: settings.scrapeCountry ?? "us",
            scrapeIntervalHours: settings.scrapeIntervalHours ?? 24,
            maxCompetitors: settings.maxCompetitors ?? 20,
            asoLocales: settings.asoLocales ?? "en-US",
          }
        : {
            ascIssuerId: "",
            ascKeyId: "",
            ascPrivateKey: "",
            ascPrivateKeySet: false,
            ascAppId: "",
            ascBundleId: "",
            ascVendorNumber: "",
            openaiApiKey: "",
            openaiApiKeySet: false,
            anthropicApiKey: "",
            anthropicApiKeySet: false,
            aiProvider: "openai",
            scrapeCountry: "us",
            scrapeIntervalHours: 24,
            maxCompetitors: 20,
            asoLocales: "en-US",
          },
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── PUT /api/settings ───────────────────────────────────────────────────────
settingsRouter.put("/", async (req, res) => {
  try {
    const {
      ascIssuerId,
      ascKeyId,
      ascPrivateKey,
      ascAppId,
      ascBundleId,
      ascVendorNumber,
      openaiApiKey,
      anthropicApiKey,
      aiProvider,
      scrapeCountry,
      scrapeIntervalHours,
      maxCompetitors,
      asoLocales,
    } = req.body as Record<string, any>;

    const data: Record<string, any> = {};
    if (ascIssuerId !== undefined) data.ascIssuerId = ascIssuerId || null;
    if (ascKeyId !== undefined) data.ascKeyId = ascKeyId || null;
    if (ascPrivateKey !== undefined && ascPrivateKey !== "••••••••")
      data.ascPrivateKey = ascPrivateKey || null;
    if (ascAppId !== undefined) data.ascAppId = ascAppId || null;
    if (ascBundleId !== undefined) data.ascBundleId = ascBundleId || null;
    if (ascVendorNumber !== undefined) data.ascVendorNumber = ascVendorNumber || null;
    if (openaiApiKey !== undefined && openaiApiKey !== "••••••••")
      data.openaiApiKey = openaiApiKey || null;
    if (anthropicApiKey !== undefined && anthropicApiKey !== "••••••••")
      data.anthropicApiKey = anthropicApiKey || null;
    if (aiProvider !== undefined) data.aiProvider = aiProvider || "openai";
    if (scrapeCountry !== undefined) data.scrapeCountry = scrapeCountry || "us";
    if (scrapeIntervalHours !== undefined)
      data.scrapeIntervalHours = Number(scrapeIntervalHours) || 24;
    if (maxCompetitors !== undefined)
      data.maxCompetitors = Number(maxCompetitors) || 20;
    if (asoLocales !== undefined) data.asoLocales = asoLocales || "en-US";

    await prisma.userSettings.upsert({
      where: { userId: req.user!.userId },
      create: { userId: req.user!.userId, ...data },
      update: data,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
