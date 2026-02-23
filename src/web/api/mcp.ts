import { Router } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../../config";
import { requireAuth } from "../auth";

export const mcpRouter = Router();
mcpRouter.use(requireAuth);

// ─── GET /api/mcp/config ──────────────────────────────────────────────────────
mcpRouter.get("/config", async (req, res) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.userId },
    });
    res.json({
      mcpEnabled: settings?.mcpEnabled ?? false,
      mcpApiKey: settings?.mcpApiKey ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── PUT /api/mcp/config ──────────────────────────────────────────────────────
mcpRouter.put("/config", async (req, res) => {
  try {
    const { mcpEnabled } = req.body as { mcpEnabled?: boolean };
    const userId = req.user!.userId;
    const data: Record<string, any> = {};
    if (mcpEnabled !== undefined) data.mcpEnabled = Boolean(mcpEnabled);

    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/mcp/regenerate-key ────────────────────────────────────────────
mcpRouter.post("/regenerate-key", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const newKey = `mcp_${randomUUID().replace(/-/g, "")}`;
    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, mcpApiKey: newKey },
      update: { mcpApiKey: newKey },
    });
    res.json({ ok: true, mcpApiKey: newKey });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
