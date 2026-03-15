import { Router } from "express";
import { randomUUID, randomBytes } from "crypto";
import { prisma } from "../../config";
import { requireAuth } from "../auth";

export const mcpRouter = Router();
mcpRouter.use(requireAuth);

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

mcpRouter.get("/oauth-clients", async (req, res) => {
  try {
    const clients = await prisma.oAuthClient.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, clientId: true, name: true, redirectUris: true, userId: true, createdAt: true },
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mcpRouter.post("/oauth-clients", async (req, res) => {
  try {
    const { name, redirectUris } = req.body as { name?: string; redirectUris?: string[] };
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const clientId = `appcore_${randomBytes(12).toString("hex")}`;
    const clientSecret = randomBytes(24).toString("hex");
    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        name: name.trim(),
        userId: req.user!.userId,
        redirectUris: redirectUris ?? [],
      },
    });

    res.json({
      id: client.id,
      clientId: client.clientId,
      clientSecret,
      name: client.name,
      redirectUris: client.redirectUris,
      createdAt: client.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mcpRouter.delete("/oauth-clients/:id", async (req, res) => {
  try {
    const client = await prisma.oAuthClient.findUnique({
      where: { id: req.params.id },
    });
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.oAuthClient.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
