import { Router } from "express";
import { prisma } from "../../config";
import { requireAuth, requireTeamAdmin, loadTeamSettings } from "../auth";
import { encrypt } from "../../config/encryption";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", loadTeamSettings, async (req, res) => {
  try {
    const settings = req.teamSettings;

    res.json(
      settings
        ? {
            ascIssuerId: settings.ascIssuerId ?? "",
            ascKeyId: settings.ascKeyId ?? "",
            ascPrivateKey: settings.ascPrivateKey ? "••••••••" : "",
            ascPrivateKeySet: !!settings.ascPrivateKey,
            ascVendorNumber: settings.ascVendorNumber ?? "",
            openaiApiKey: settings.openaiApiKey ? "••••••••" : "",
            openaiApiKeySet: !!settings.openaiApiKey,
            anthropicApiKey: settings.anthropicApiKey ? "••••••••" : "",
            anthropicApiKeySet: !!settings.anthropicApiKey,
            aiProvider: settings.aiProvider ?? "openai",
            presetCopyright: settings.presetCopyright ?? "",
            reviewerFirstName: settings.reviewerFirstName ?? "",
            reviewerLastName: settings.reviewerLastName ?? "",
            reviewerPhone: settings.reviewerPhone ?? "",
            reviewerEmail: settings.reviewerEmail ?? "",
            reviewerDemoAccountRequired: settings.reviewerDemoAccountRequired ?? false,
            reviewerDemoUsername: settings.reviewerDemoUsername ?? "",
            reviewerDemoPassword: settings.reviewerDemoPassword ?? "",
          }
        : {
            ascIssuerId: "",
            ascKeyId: "",
            ascPrivateKey: "",
            ascPrivateKeySet: false,
            ascVendorNumber: "",
            openaiApiKey: "",
            openaiApiKeySet: false,
            anthropicApiKey: "",
            anthropicApiKeySet: false,
            aiProvider: "openai",
            presetCopyright: "",
            reviewerFirstName: "",
            reviewerLastName: "",
            reviewerPhone: "",
            reviewerEmail: "",
            reviewerDemoAccountRequired: false,
            reviewerDemoUsername: "",
            reviewerDemoPassword: "",
          },
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

settingsRouter.put("/", async (req, res) => {
  try {
    if (!(await requireTeamAdmin(req, res))) return;
    const teamId = req.user!.teamId;

    const {
      ascIssuerId,
      ascKeyId,
      ascPrivateKey,
      ascVendorNumber,
      openaiApiKey,
      anthropicApiKey,
      aiProvider,
      presetCopyright,
      reviewerFirstName,
      reviewerLastName,
      reviewerPhone,
      reviewerEmail,
      reviewerDemoAccountRequired,
      reviewerDemoUsername,
      reviewerDemoPassword,
    } = req.body as Record<string, any>;

    const data: Record<string, any> = {};
    if (ascIssuerId !== undefined) data.ascIssuerId = ascIssuerId || null;
    if (ascKeyId !== undefined) data.ascKeyId = ascKeyId || null;
    if (ascPrivateKey !== undefined && ascPrivateKey !== "••••••••")
      data.ascPrivateKey = ascPrivateKey ? encrypt(ascPrivateKey) : null;
    if (ascVendorNumber !== undefined) data.ascVendorNumber = ascVendorNumber || null;
    if (openaiApiKey !== undefined && openaiApiKey !== "••••••••")
      data.openaiApiKey = openaiApiKey ? encrypt(openaiApiKey) : null;
    if (anthropicApiKey !== undefined && anthropicApiKey !== "••••••••")
      data.anthropicApiKey = anthropicApiKey ? encrypt(anthropicApiKey) : null;
    if (aiProvider !== undefined) data.aiProvider = aiProvider || "openai";
    if (presetCopyright !== undefined) data.presetCopyright = presetCopyright || null;
    if (reviewerFirstName !== undefined) data.reviewerFirstName = reviewerFirstName || null;
    if (reviewerLastName !== undefined) data.reviewerLastName = reviewerLastName || null;
    if (reviewerPhone !== undefined) data.reviewerPhone = reviewerPhone || null;
    if (reviewerEmail !== undefined) data.reviewerEmail = reviewerEmail || null;
    if (reviewerDemoAccountRequired !== undefined) data.reviewerDemoAccountRequired = !!reviewerDemoAccountRequired;
    if (reviewerDemoUsername !== undefined) data.reviewerDemoUsername = reviewerDemoUsername || null;
    if (reviewerDemoPassword !== undefined) data.reviewerDemoPassword = reviewerDemoPassword || null;

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
