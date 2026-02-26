import { Router } from "express";
import axios from "axios";
import { prisma, logger, getEffectiveSettings } from "../../config";
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

    getEffectiveSettings(req.user!.userId)
      .then(async (settings) => {
        const effectiveSettings = { ...settings, ascBundleId: bundleId };
        const { AppStoreScraper } =
          await import("../../services/appstore-scraper");
        const scraper = new AppStoreScraper(effectiveSettings);
        await scraper.runFullScrapeJob();
        logger.info(`Post-import scrape completed for ${bundleId}`);
      })
      .catch((err) =>
        logger.error(`Post-import scrape failed for ${bundleId}`, err),
      );
  } catch (err: any) {
    logger.error("ASC import failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── GET /api/asc/versions/list ───────────────────────────────────────────
ascRouter.get("/versions/list", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || undefined;
    const asc = await ascClientForUser(req.user!.userId);
    const app = await asc.getApp(bundleId);
    if (!app) {
      res.status(404).json({ error: "App not found in App Store Connect" });
      return;
    }

    const editableStates = new Set([
      "PREPARE_FOR_SUBMISSION",
      "DEVELOPER_REJECTED",
      "REJECTED",
      "METADATA_REJECTED",
      "WAITING_FOR_REVIEW",
      "PENDING_DEVELOPER_RELEASE",
    ]);

    const versions = await asc.listVersions(app.id);
    res.json(
      versions.map((v) => ({
        versionId: v.id,
        versionString: v.attributes.versionString,
        appStoreState: v.attributes.appStoreState,
        platform: v.attributes.platform,
        isEditable: editableStates.has(v.attributes.appStoreState),
      })),
    );
  } catch (err: any) {
    logger.error("ASC listVersions failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── GET /api/asc/versions ─────────────────────────────────────────────────
ascRouter.get("/versions", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || undefined;
    const versionId = (req.query.versionId as string) || undefined;
    const asc = await ascClientForUser(req.user!.userId);
    const app = await asc.getApp(bundleId);
    if (!app) {
      res.status(404).json({ error: "App not found in App Store Connect" });
      return;
    }

    const appInfoLocalizations = await asc.getAppInfoLocalizations(app.id);

    const editableStates = new Set([
      "PREPARE_FOR_SUBMISSION",
      "DEVELOPER_REJECTED",
      "REJECTED",
      "METADATA_REJECTED",
      "WAITING_FOR_REVIEW",
      "PENDING_DEVELOPER_RELEASE",
    ]);

    let version: { id: string; attributes: { versionString: string; appStoreState: string; platform: string; releaseType: string } } | null = null;

    if (versionId) {
      const allVersions = await asc.listVersions(app.id);
      version = allVersions.find((v) => v.id === versionId) ?? null;
    } else {
      version = await asc.getEditableVersion(app.id);
      if (!version) version = await asc.getLiveVersion(app.id);
    }

    const isEditable = version ? editableStates.has(version.attributes.appStoreState) : false;

    let versionLocalizations: any[] = [];
    if (version) {
      versionLocalizations = await asc.getVersionLocalizations(version.id);
    }

    const localeMap = new Map<string, any>();

    for (const info of appInfoLocalizations) {
      const loc = info.attributes.locale;
      localeMap.set(loc, {
        locale: loc,
        appInfoLocalizationId: info.id,
        name: info.attributes.name ?? "",
        subtitle: info.attributes.subtitle ?? "",
        description: "",
        keywords: "",
        whatsNew: "",
        promotionalText: "",
        versionLocalizationId: null,
      });
    }

    for (const vl of versionLocalizations) {
      const loc = vl.attributes.locale;
      const existing = localeMap.get(loc) ?? {
        locale: loc,
        appInfoLocalizationId: null,
        name: "",
        subtitle: "",
      };
      localeMap.set(loc, {
        ...existing,
        versionLocalizationId: vl.id,
        description: vl.attributes.description ?? "",
        keywords: vl.attributes.keywords ?? "",
        whatsNew: vl.attributes.whatsNew ?? "",
        promotionalText: vl.attributes.promotionalText ?? "",
      });
    }

    res.json({
      appId: app.id,
      appName: app.attributes.name,
      bundleId: app.attributes.bundleId,
      versionId: version?.id ?? null,
      versionString: version?.attributes.versionString ?? null,
      appStoreState: version?.attributes.appStoreState ?? null,
      isEditable,
      localizations: Array.from(localeMap.values()),
    });
  } catch (err: any) {
    logger.error("ASC getVersions failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── PATCH /api/asc/versions/metadata ──────────────────────────────────────
ascRouter.patch("/versions/metadata", async (req, res) => {
  try {
    const { appInfoLocalizationId, versionLocalizationId, field, value } =
      req.body as {
        appInfoLocalizationId?: string;
        versionLocalizationId?: string;
        field: string;
        value: string;
      };

    if (!field || value === undefined) {
      res.status(400).json({ error: "field and value are required" });
      return;
    }

    const asc = await ascClientForUser(req.user!.userId);

    if (field === "name" || field === "subtitle") {
      if (!appInfoLocalizationId) {
        res
          .status(400)
          .json({
            error: "appInfoLocalizationId is required for name/subtitle",
          });
        return;
      }
      await asc.updateAppInfoLocalization(appInfoLocalizationId, {
        [field]: value,
      });
      res.json({ ok: true, field, value });
      return;
    }

    const versionFields = [
      "description",
      "keywords",
      "whatsNew",
      "promotionalText",
    ];
    if (versionFields.includes(field)) {
      if (!versionLocalizationId) {
        res
          .status(400)
          .json({
            error: "versionLocalizationId is required for version fields",
          });
        return;
      }
      await asc.updateVersionLocalization(versionLocalizationId, {
        [field]: value,
      });
      res.json({ ok: true, field, value });
      return;
    }

    res.status(400).json({ error: `Unknown field: ${field}` });
  } catch (err: any) {
    logger.error("ASC updateMetadata failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});
