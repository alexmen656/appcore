import { Router } from "express";
import { prisma } from "../../config";
import { requireAuth } from "../auth";
import { encrypt } from "../../config/encryption";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (req, res) => {
  try {
    const teamId = req.user!.teamId;
    const settings = teamId
      ? await prisma.teamSettings.findUnique({ where: { teamId } })
      : null;

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
          },
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

settingsRouter.put("/", async (req, res) => {
  try {
    const teamId = req.user!.teamId;
    if (!teamId) {
      res.status(403).json({ error: "No team" });
      return;
    }

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
    } = req.body as Record<string, any>;

    const data: Record<string, any> = {};
    if (ascIssuerId !== undefined) data.ascIssuerId = ascIssuerId || null;
    if (ascKeyId !== undefined) data.ascKeyId = ascKeyId || null;
    if (ascPrivateKey !== undefined && ascPrivateKey !== "••••••••")
      data.ascPrivateKey = ascPrivateKey ? encrypt(ascPrivateKey) : null;
    if (ascAppId !== undefined) data.ascAppId = ascAppId || null;
    if (ascBundleId !== undefined) data.ascBundleId = ascBundleId || null;
    if (ascVendorNumber !== undefined)
      data.ascVendorNumber = ascVendorNumber || null;
    if (openaiApiKey !== undefined && openaiApiKey !== "••••••••")
      data.openaiApiKey = openaiApiKey ? encrypt(openaiApiKey) : null;
    if (anthropicApiKey !== undefined && anthropicApiKey !== "••••••••")
      data.anthropicApiKey = anthropicApiKey ? encrypt(anthropicApiKey) : null;
    if (aiProvider !== undefined) data.aiProvider = aiProvider || "openai";

    await prisma.teamSettings.upsert({
      where: { teamId },
      create: { teamId, ...data },
      update: data,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
