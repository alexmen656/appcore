import { Router, Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { pushService } from "../../services/push-notification.js";
import { logger } from "../../config/logger.js";

const router = Router();

// POST /api/push/register - Register a device token
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { deviceToken, bundleId } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ error: "deviceToken is required" });
    }

    const db = prisma;
    const userId = (req as any).userId || null;

    await db.deviceToken.upsert({
      where: { token: deviceToken },
      create: {
        token: deviceToken,
        userId,
        bundleId: bundleId || null,
        platform: "ios",
        isActive: true,
      },
      update: {
        userId,
        bundleId: bundleId || null,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    logger.info(`[PUSH] Device registered: ${deviceToken.substring(0, 8)}...`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error(`[PUSH] Registration error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/push/unregister - Unregister a device token
router.post("/unregister", async (req: Request, res: Response) => {
  try {
    const { deviceToken } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ error: "deviceToken is required" });
    }

    const db = prisma;
    await db.deviceToken.updateMany({
      where: { token: deviceToken },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error(`[PUSH] Unregister error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/push/send - Send a push notification (admin only)
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { title, body, category, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const result = await pushService.sendToAll({ title, body, category, data });
    res.json(result);
  } catch (error: any) {
    logger.error(`[PUSH] Send error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/push/test - Send a test notification to the requesting user's devices
router.post("/test", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await pushService.sendToUser(userId, {
      title: "🧪 Test Notification",
      body: "Push notifications are working!",
      category: "JOB_COMPLETE",
    });

    res.json(result);
  } catch (error: any) {
    logger.error(`[PUSH] Test error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/push/devices - List registered devices (admin)
router.get("/devices", async (_req: Request, res: Response) => {
  try {
    const db = prisma;
    const devices = await db.deviceToken.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(devices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/push/logs - Get push notification logs
router.get("/logs", async (req: Request, res: Response) => {
  try {
    const db = prisma;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await db.pushNotificationLog.findMany({
      orderBy: { sentAt: "desc" },
      take: limit,
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
