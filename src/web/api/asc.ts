import { Router } from "express";
import axios from "axios";
import { prisma, logger, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";
import { AppStoreConnectClient } from "../../services/appstore-connect";
import { AIAnalyzer } from "../../services/ai-analyzer";

export const ascRouter = Router();
ascRouter.use(requireAuth);

async function ascClientForUser(
  userId: string,
): Promise<AppStoreConnectClient> {
  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const s = membership
    ? await prisma.teamSettings.findUnique({
        where: { teamId: membership.teamId },
      })
    : null;
  if (s?.ascIssuerId && s?.ascKeyId && s?.ascPrivateKey) {
    return new AppStoreConnectClient({
      issuerId: s.ascIssuerId,
      keyId: s.ascKeyId,
      privateKey: s.ascPrivateKey,
    });
  }
  return new AppStoreConnectClient();
}

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

    const teamId = req.user!.teamId ?? undefined;

    const app = await prisma.app.upsert({
      where: { bundleId },
      create: {
        bundleId,
        name,
        trackId: BigInt(ascId),
        isOwnApp: true,
        country: "us",
        teamId,
      },
      update: {
        name,
        trackId: BigInt(ascId),
        isOwnApp: true,
        ...(teamId ? { teamId } : {}),
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

    let version: {
      id: string;
      attributes: {
        versionString: string;
        appStoreState: string;
        platform: string;
        releaseType: string;
      };
    } | null = null;

    if (versionId) {
      const allVersions = await asc.listVersions(app.id);
      version = allVersions.find((v) => v.id === versionId) ?? null;
    } else {
      version = await asc.getEditableVersion(app.id);
      if (!version) version = await asc.getLiveVersion(app.id);
    }

    const isEditable = version
      ? editableStates.has(version.attributes.appStoreState)
      : false;

    let versionLocalizations: any[] = [];
    if (version) {
      versionLocalizations = await asc.getVersionLocalizations(version.id);
    }

    const localeMap = new Map<string, any>();

    // For editable (current) versions, show all locales from appInfoLocalizations
    // so newly added languages appear and can be filled in.
    // For historical (non-editable) versions, only show locales that were
    // actually published — i.e. those present in versionLocalizations.
    if (isEditable) {
      for (const info of appInfoLocalizations) {
        const loc = info.attributes.locale;
        localeMap.set(loc, {
          locale: loc,
          appInfoLocalizationId: info.id,
          name: info.attributes.name ?? "",
          subtitle: info.attributes.subtitle ?? "",
          privacyPolicyUrl: info.attributes.privacyPolicyUrl ?? "",
          description: "",
          keywords: "",
          whatsNew: "",
          promotionalText: "",
          versionLocalizationId: null,
        });
      }
    }

    const appInfoById = new Map(
      appInfoLocalizations.map((info: any) => [info.attributes.locale, info]),
    );

    for (const vl of versionLocalizations) {
      const loc = vl.attributes.locale;
      const existing = localeMap.get(loc);
      const appInfo = appInfoById.get(loc) as any | undefined;
      localeMap.set(loc, {
        locale: loc,
        appInfoLocalizationId: existing?.appInfoLocalizationId ?? appInfo?.id ?? null,
        name: existing?.name ?? appInfo?.attributes.name ?? "",
        subtitle: existing?.subtitle ?? appInfo?.attributes.subtitle ?? "",
        privacyPolicyUrl: existing?.privacyPolicyUrl ?? appInfo?.attributes.privacyPolicyUrl ?? "",
        versionLocalizationId: vl.id,
        description: vl.attributes.description ?? "",
        keywords: vl.attributes.keywords ?? "",
        whatsNew: vl.attributes.whatsNew ?? "",
        promotionalText: vl.attributes.promotionalText ?? "",
        supportUrl: vl.attributes.supportUrl ?? "",
        marketingUrl: vl.attributes.marketingUrl ?? "",
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

    if (
      field === "name" ||
      field === "subtitle" ||
      field === "privacyPolicyUrl"
    ) {
      if (!appInfoLocalizationId) {
        res.status(400).json({
          error:
            "appInfoLocalizationId is required for app info localization fields",
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
      "supportUrl",
    ];
    if (versionFields.includes(field)) {
      if (!versionLocalizationId) {
        res.status(400).json({
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

ascRouter.post("/versions/localizations", async (req, res) => {
  try {
    const { bundleId, versionId, locale, name } = req.body as {
      bundleId?: string;
      versionId: string;
      locale: string;
      name: string;
    };

    if (!versionId || !locale || !name) {
      res
        .status(400)
        .json({ error: "versionId, locale and name are required" });
      return;
    }

    const asc = await ascClientForUser(req.user!.userId);
    const app = await asc.getApp(bundleId);
    if (!app) {
      res.status(404).json({ error: "App not found in App Store Connect" });
      return;
    }

    const appInfoId = await asc.getAppInfoId(app.id);
    if (!appInfoId) {
      res.status(404).json({ error: "App info not found" });
      return;
    }

    const tryCreate = async <T>(
      fn: () => Promise<T>,
      swallow500 = false,
    ): Promise<T | null> => {
      try {
        return await fn();
      } catch (err: any) {
        const msg: string = err?.message ?? "";
        if (msg.includes("409")) return null;
        if (swallow500 && msg.includes("500")) {
          logger.warn(
            `Skipping creation (locale not supported by ASC): ${msg.split("\n")[0]}`,
          );
          return null;
        }
        throw err;
      }
    };

    const [appInfoLoc, versionLoc] = await Promise.all([
      tryCreate(
        () => asc.createAppInfoLocalization(appInfoId, locale, name),
        true,
      ),
      tryCreate(() => asc.createVersionLocalization(versionId, locale)),
    ]);

    let appInfoLocalizationId = appInfoLoc?.id ?? null;
    if (!appInfoLocalizationId) {
      const existing = await asc.getAppInfoLocalizations(app.id, appInfoId);
      appInfoLocalizationId =
        existing.find((l) => l.attributes.locale === locale)?.id ?? null;
    }

    let versionLocalizationId = versionLoc?.id ?? null;
    if (!versionLocalizationId) {
      const versionLocs = await asc.getVersionLocalizations(versionId);
      versionLocalizationId =
        versionLocs.find((l: any) => l.attributes.locale === locale)?.id ??
        null;
    }
    res.json({
      ok: true,
      locale,
      appInfoLocalizationId,
      versionLocalizationId,
    });
  } catch (err: any) {
    logger.error("ASC createLocalization failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.delete("/versions/localizations", async (req, res) => {
  try {
    const { appInfoLocalizationId, versionLocalizationId } = req.body as {
      appInfoLocalizationId?: string;
      versionLocalizationId?: string;
    };

    if (!appInfoLocalizationId && !versionLocalizationId) {
      res
        .status(400)
        .json({ error: "At least one localization ID is required" });
      return;
    }

    const asc = await ascClientForUser(req.user!.userId);
    await Promise.all([
      appInfoLocalizationId
        ? asc.deleteAppInfoLocalization(appInfoLocalizationId)
        : Promise.resolve(),
      versionLocalizationId
        ? asc.deleteVersionLocalization(versionLocalizationId)
        : Promise.resolve(),
    ]);

    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC deleteLocalization failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/versions/localizations/translate", async (req, res) => {
  try {
    const { targetLocale, sourceLocale, sourceFields } = req.body as {
      targetLocale: string;
      sourceLocale: string;
      sourceFields: {
        name?: string;
        subtitle?: string;
        keywords?: string;
        description?: string;
        promotionalText?: string;
        whatsNew?: string;
      };
    };

    if (!targetLocale || !sourceLocale || !sourceFields) {
      res.status(400).json({
        error: "targetLocale, sourceLocale, and sourceFields are required",
      });
      return;
    }

    const settings = await getEffectiveSettings(req.user!.userId);
    const analyzer = new AIAnalyzer(settings);

    const fields = await analyzer.translateLocalization(
      sourceLocale,
      targetLocale,
      sourceFields,
    );
    res.json({ ok: true, fields });
  } catch (err: any) {
    logger.error("ASC translateLocalization failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/versions", async (req, res) => {
  try {
    const { bundleId, versionString, releaseType } = req.body as {
      bundleId?: string;
      versionString: string;
      releaseType?: "MANUAL" | "AFTER_APPROVAL";
    };

    if (!versionString) {
      res.status(400).json({ error: "versionString is required" });
      return;
    }

    const asc = await ascClientForUser(req.user!.userId);
    const app = await asc.getApp(bundleId);
    if (!app) {
      res.status(404).json({ error: "App not found in App Store Connect" });
      return;
    }

    const version = await asc.createNewVersion(
      app.id,
      versionString,
      releaseType ?? "MANUAL",
    );

    res.json({
      versionId: version.id,
      versionString: version.attributes.versionString,
      appStoreState: version.attributes.appStoreState,
      platform: version.attributes.platform,
      isEditable: true,
    });
  } catch (err: any) {
    logger.error("ASC createVersion failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});
