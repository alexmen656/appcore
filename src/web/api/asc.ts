import { Router } from "express";
import axios from "axios";
import { prisma, logger } from "../../config";
import { requireAuth } from "../auth";
import { AppStoreConnectClient } from "../../services/appstore-connect";

export const ascRouter = Router();
ascRouter.use(requireAuth);

async function ascClientForUser(
  userId: string,
): Promise<AppStoreConnectClient> {
  const s = await prisma.userSettings.findUnique({ where: { userId } });
  if (s?.ascIssuerId && s?.ascKeyId && s?.ascPrivateKey) {
    return new AppStoreConnectClient({
      issuerId: s.ascIssuerId,
      keyId: s.ascKeyId,
      privateKey: s.ascPrivateKey,
    });
  }
  return new AppStoreConnectClient();
}

// ─── GET /api/asc/apps ──────────────────────────────────────────────────────
ascRouter.get("/apps", async (req, res) => {
  try {
    const asc = await ascClientForUser(req.user!.userId);
    const apps = await asc.listApps();
    const iconMap = new Map<string, string>();

    if (apps.length > 0) {
      try {
        const ids = apps.map((a) => a.id).join(",");
        const { data } = await axios.get(
          `https://itunes.apple.com/lookup?id=${ids}`,
        );
        for (const r of data.results ?? []) {
          if (r.trackId && r.artworkUrl100) {
            iconMap.set(
              String(r.trackId),
              (r.artworkUrl100 as string).replace("100x100", "200x200"),
            );
          }
        }
      } catch {
        // icons are optional
      }
    }

    res.json(
      apps.map((a) => ({
        ascId: a.id,
        name: a.attributes.name,
        bundleId: a.attributes.bundleId,
        sku: a.attributes.sku ?? null,
        primaryLocale: a.attributes.primaryLocale ?? null,
        iconUrl: iconMap.get(a.id) ?? null,
      })),
    );
  } catch (err: any) {
    logger.error("ASC listApps failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── POST /api/asc/import ──────────────────────────────────────────────────
ascRouter.post("/import", async (req, res) => {
  try {
    const { ascId, bundleId, name } = req.body as {
      ascId?: string;
      bundleId?: string;
      name?: string;
    };

    if (!ascId || !bundleId || !name) {
      res.status(400).json({ error: "ascId, bundleId and name are required" });
      return;
    }

    const app = await prisma.app.upsert({
      where: { bundleId },
      create: {
        bundleId,
        name,
        trackId: BigInt(ascId),
        isOwnApp: true,
        country: "us",
      },
      update: {
        name,
        trackId: BigInt(ascId),
        isOwnApp: true,
      },
    });

    res.json({
      ok: true,
      app: {
        id: app.id,
        name: app.name,
        bundleId: app.bundleId,
        trackId: app.trackId?.toString() ?? null,
        isOwnApp: app.isOwnApp,
      },
    });
  } catch (err: any) {
    logger.error("ASC import failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});
