import { Router } from "express";
import axios from "axios";
import { prisma, logger, getEffectiveSettings } from "../../config";
import { requireAuth, verifyAppOwnershipByBundleId } from "../auth";
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
    const apps = await ascClientForUser(req.user!.userId).then((c) =>
      c.listApps(),
    );
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
    const existing = await prisma.app.findUnique({ where: { bundleId } });

    if (
      existing &&
      existing.teamId &&
      existing.teamId !== teamId &&
      req.user!.role !== "ADMIN"
    ) {
      res.status(403).json({ error: "App is owned by another team" });
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

    const { AppStoreScraper } = await import("../../services/appstore-scraper");
    await new AppStoreScraper(
      app.country,
      undefined,
      bundleId,
    ).runFullScrapeJob();

    logger.info(`Post-import scrape completed for ${bundleId}`);
  } catch (err: any) {
    logger.error("ASC import failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.get("/versions/list", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || undefined;
    if (bundleId) {
      const owned = await verifyAppOwnershipByBundleId(req, res, bundleId);
      if (!owned) return;
    }
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
    if (bundleId) {
      const owned = await verifyAppOwnershipByBundleId(req, res, bundleId);
      if (!owned) return;
    }
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

    const appInfoById = new Map(
      appInfoLocalizations.map((info: any) => [info.attributes.locale, info]),
    );

    for (const vl of versionLocalizations) {
      const loc = vl.attributes.locale;
      const existing = localeMap.get(loc);
      const appInfo = appInfoById.get(loc) as any | undefined;
      localeMap.set(loc, {
        locale: loc,
        appInfoLocalizationId:
          existing?.appInfoLocalizationId ?? appInfo?.id ?? null,
        name: existing?.name ?? appInfo?.attributes.name ?? "",
        subtitle: existing?.subtitle ?? appInfo?.attributes.subtitle ?? "",
        privacyPolicyUrl:
          existing?.privacyPolicyUrl ??
          appInfo?.attributes.privacyPolicyUrl ??
          "",
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
    const {
      bundleId,
      appInfoLocalizationId,
      versionLocalizationId,
      field,
      value,
    } = req.body as {
      bundleId?: string;
      appInfoLocalizationId?: string;
      versionLocalizationId?: string;
      field: string;
      value: string;
    };

    if (!field || value === undefined) {
      res.status(400).json({ error: "field and value are required" });
      return;
    }
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }
    const ownedApp = await verifyAppOwnershipByBundleId(req, res, bundleId);
    if (!ownedApp) return;

    const asc = await ascClientForUser(req.user!.userId);

    const METADATA_FIELDS = {
      appInfo: {
        fields: ["name", "subtitle", "privacyPolicyUrl"],
        localizationId: appInfoLocalizationId,
        errorMsg:
          "appInfoLocalizationId is required for app info localization fields",
        update: (id: string) =>
          asc.updateAppInfoLocalization(id, { [field]: value }),
      },
      version: {
        fields: [
          "description",
          "keywords",
          "whatsNew",
          "promotionalText",
          "supportUrl",
          "marketingUrl",
        ],
        localizationId: versionLocalizationId,
        errorMsg: "versionLocalizationId is required for version fields",
        update: (id: string) =>
          asc.updateVersionLocalization(id, { [field]: value }),
      },
    };

    const matchedGroup = Object.values(METADATA_FIELDS).find((g) =>
      g.fields.includes(field),
    );

    if (!matchedGroup) {
      res.status(400).json({ error: `Unknown field: ${field}` });
      return;
    }
    if (!matchedGroup.localizationId) {
      res.status(400).json({ error: matchedGroup.errorMsg });
      return;
    }
    await matchedGroup.update(matchedGroup.localizationId);
    res.json({ ok: true, field, value });
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
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }
    const ownedApp = await verifyAppOwnershipByBundleId(req, res, bundleId);
    if (!ownedApp) return;

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
    const { bundleId, appInfoLocalizationId, versionLocalizationId } =
      req.body as {
        bundleId?: string;
        appInfoLocalizationId?: string;
        versionLocalizationId?: string;
      };

    if (!appInfoLocalizationId && !versionLocalizationId) {
      res
        .status(400)
        .json({ error: "At least one localization ID is required" });
      return;
    }
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }
    const ownedApp = await verifyAppOwnershipByBundleId(req, res, bundleId);
    if (!ownedApp) return;

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
    const analyzer = new AIAnalyzer("", settings);

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
    if (!bundleId) {
      res.status(400).json({ error: "bundleId required" });
      return;
    }
    const ownedApp = await verifyAppOwnershipByBundleId(req, res, bundleId);
    if (!ownedApp) return;

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

ascRouter.get("/subscriptions/groups", async (req, res) => {
  try {
    const bundleId = (req.query.bundleId as string) || undefined;
    if (bundleId) {
      const owned = await verifyAppOwnershipByBundleId(req, res, bundleId);
      if (!owned) return;
    }
    const asc = await ascClientForUser(req.user!.userId);
    const app = await asc.getApp(bundleId);
    if (!app) {
      res.status(404).json({ error: "App not found in App Store Connect" });
      return;
    }

    const { data: resp } = await (asc as any).client.get(
      `/apps/${app.id}/subscriptionGroups`,
      {
        params: {
          include: "subscriptions",
          "fields[subscriptionGroups]": "referenceName,subscriptions",
          "fields[subscriptions]":
            "name,productId,familySharable,state,subscriptionPeriod,reviewNote,groupLevel",
          "limit[subscriptions]": 50,
          limit: 200,
        },
      },
    );

    const included: any[] = resp.included ?? [];
    const subMap = new Map<string, any>(included.map((s: any) => [s.id, s]));

    const groups = (resp.data ?? []).map((g: any) => ({
      id: g.id,
      referenceName: g.attributes?.referenceName ?? "",
      subscriptions: (g.relationships?.subscriptions?.data ?? [])
        .map((ref: any) => {
          const s = subMap.get(ref.id);
          if (!s) return null;
          return {
            id: s.id,
            name: s.attributes?.name ?? "",
            productId: s.attributes?.productId ?? "",
            familySharable: s.attributes?.familySharable ?? false,
            state: s.attributes?.state ?? "",
            subscriptionPeriod: s.attributes?.subscriptionPeriod ?? null,
            reviewNote: s.attributes?.reviewNote ?? null,
            groupLevel: s.attributes?.groupLevel ?? null,
          };
        })
        .filter(Boolean),
    }));

    res.json(groups);
  } catch (err: any) {
    logger.error("ASC listSubscriptionGroups failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/subscriptions/groups", async (req, res) => {
  try {
    const { bundleId, referenceName } = req.body as {
      bundleId?: string;
      referenceName?: string;
    };
    if (!referenceName) {
      res.status(400).json({ error: "referenceName is required" });
      return;
    }
    if (bundleId) {
      const owned = await verifyAppOwnershipByBundleId(req, res, bundleId);
      if (!owned) return;
    }
    const asc = await ascClientForUser(req.user!.userId);
    const app = await asc.getApp(bundleId);
    if (!app) {
      res.status(404).json({ error: "App not found in App Store Connect" });
      return;
    }

    const { data: resp } = await (asc as any).client.post(
      "/subscriptionGroups",
      {
        data: {
          type: "subscriptionGroups",
          attributes: { referenceName },
          relationships: {
            app: { data: { type: "apps", id: app.id } },
          },
        },
      },
    );

    res.status(201).json({
      id: resp.data.id,
      referenceName: resp.data.attributes?.referenceName ?? referenceName,
      subscriptions: [],
    });
  } catch (err: any) {
    logger.error("ASC createSubscriptionGroup failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.patch("/subscriptions/groups/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { referenceName } = req.body as { referenceName?: string };
    if (!referenceName) {
      res.status(400).json({ error: "referenceName is required" });
      return;
    }
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.patch(`/subscriptionGroups/${id}`, {
      data: {
        type: "subscriptionGroups",
        id,
        attributes: { referenceName },
      },
    });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC updateSubscriptionGroup failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.delete("/subscriptions/groups/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.delete(`/subscriptionGroups/${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC deleteSubscriptionGroup failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/subscriptions", async (req, res) => {
  try {
    const {
      groupId,
      name,
      productId,
      familySharable,
      subscriptionPeriod,
      groupLevel,
      reviewNote,
    } = req.body as {
      groupId?: string;
      name?: string;
      productId?: string;
      familySharable?: boolean;
      subscriptionPeriod?: string;
      groupLevel?: number;
      reviewNote?: string;
    };
    if (!groupId || !name || !productId || !subscriptionPeriod) {
      res
        .status(400)
        .json({
          error: "groupId, name, productId and subscriptionPeriod are required",
        });
      return;
    }

    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.post("/subscriptions", {
      data: {
        type: "subscriptions",
        attributes: {
          name,
          productId,
          familySharable: familySharable ?? false,
          subscriptionPeriod,
          ...(groupLevel != null ? { groupLevel } : {}),
          ...(reviewNote ? { reviewNote } : {}),
        },
        relationships: {
          group: { data: { type: "subscriptionGroups", id: groupId } },
        },
      },
    });

    res.status(201).json({
      id: resp.data.id,
      name: resp.data.attributes?.name ?? name,
      productId: resp.data.attributes?.productId ?? productId,
      familySharable: resp.data.attributes?.familySharable ?? false,
      state: resp.data.attributes?.state ?? "",
      subscriptionPeriod:
        resp.data.attributes?.subscriptionPeriod ?? subscriptionPeriod,
      reviewNote: resp.data.attributes?.reviewNote ?? null,
      groupLevel: resp.data.attributes?.groupLevel ?? null,
    });
  } catch (err: any) {
    logger.error("ASC createSubscription failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.patch("/subscriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, familySharable, subscriptionPeriod, reviewNote, groupLevel } =
      req.body as {
        name?: string;
        familySharable?: boolean;
        subscriptionPeriod?: string;
        reviewNote?: string;
        groupLevel?: number;
      };

    const attributes: Record<string, any> = {};
    if (name !== undefined) attributes.name = name;
    if (familySharable !== undefined)
      attributes.familySharable = familySharable;
    if (subscriptionPeriod !== undefined)
      attributes.subscriptionPeriod = subscriptionPeriod;
    if (reviewNote !== undefined) attributes.reviewNote = reviewNote;
    if (groupLevel !== undefined) attributes.groupLevel = groupLevel;

    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.patch(`/subscriptions/${id}`, {
      data: { type: "subscriptions", id, attributes },
    });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC updateSubscription failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.delete("/subscriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.delete(`/subscriptions/${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC deleteSubscription failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.get("/subscriptions/:id/localizations", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.get(
      `/subscriptions/${id}/subscriptionLocalizations`,
      {
        params: {
          "fields[subscriptionLocalizations]": "name,locale,description,state",
          limit: 200,
        },
      },
    );
    res.json(
      (resp.data ?? []).map((l: any) => ({
        id: l.id,
        locale: l.attributes?.locale ?? "",
        name: l.attributes?.name ?? "",
        description: l.attributes?.description ?? "",
        state: l.attributes?.state ?? "",
      })),
    );
  } catch (err: any) {
    logger.error("ASC listSubscriptionLocalizations failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/subscriptions/localizations", async (req, res) => {
  try {
    const { subscriptionId, locale, name, description } = req.body as {
      subscriptionId?: string;
      locale?: string;
      name?: string;
      description?: string;
    };
    if (!subscriptionId || !locale || !name) {
      res
        .status(400)
        .json({ error: "subscriptionId, locale and name are required" });
      return;
    }
    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.post(
      "/subscriptionLocalizations",
      {
        data: {
          type: "subscriptionLocalizations",
          attributes: { locale, name, ...(description ? { description } : {}) },
          relationships: {
            subscription: {
              data: { type: "subscriptions", id: subscriptionId },
            },
          },
        },
      },
    );
    res.status(201).json({
      id: resp.data.id,
      locale: resp.data.attributes?.locale ?? locale,
      name: resp.data.attributes?.name ?? name,
      description: resp.data.attributes?.description ?? description ?? "",
      state: resp.data.attributes?.state ?? "",
    });
  } catch (err: any) {
    logger.error("ASC createSubscriptionLocalization failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.patch("/subscriptions/localizations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };
    const attributes: Record<string, any> = {};
    if (name !== undefined) attributes.name = name;
    if (description !== undefined) attributes.description = description;
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.patch(`/subscriptionLocalizations/${id}`, {
      data: { type: "subscriptionLocalizations", id, attributes },
    });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC updateSubscriptionLocalization failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.delete("/subscriptions/localizations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.delete(`/subscriptionLocalizations/${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC deleteSubscriptionLocalization failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.get("/subscriptions/:id/price-points", async (req, res) => {
  try {
    const { id } = req.params;
    const territory = (req.query.territory as string) || undefined;
    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.get(
      `/subscriptions/${id}/pricePoints`,
      {
        params: {
          include: "territory",
          "fields[subscriptionPricePoints]": "customerPrice,proceeds,territory",
          "fields[territories]": "currency",
          ...(territory ? { "filter[territory]": territory } : {}),
          limit: 8000,
        },
      },
    );
    const included: any[] = resp.included ?? [];
    const terrMap = new Map<string, any>(included.map((t: any) => [t.id, t]));
    res.json(
      (resp.data ?? []).map((pp: any) => {
        const terrId = pp.relationships?.territory?.data?.id ?? null;
        const terr = terrId ? terrMap.get(terrId) : null;
        return {
          id: pp.id,
          customerPrice: pp.attributes?.customerPrice ?? null,
          proceeds: pp.attributes?.proceeds ?? null,
          territory: terrId,
          currency: terr?.attributes?.currency ?? null,
        };
      }),
    );
  } catch (err: any) {
    logger.error("ASC listSubscriptionPricePoints failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.get("/subscriptions/:id/prices", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.get(
      `/subscriptions/${id}/prices`,
      {
        params: {
          include: "territory,subscriptionPricePoint",
          "fields[subscriptionPrices]":
            "startDate,preserved,territory,subscriptionPricePoint",
          "fields[territories]": "currency",
          "fields[subscriptionPricePoints]": "customerPrice,proceeds,territory",
          limit: 200,
        },
      },
    );
    const included: any[] = resp.included ?? [];
    const terrMap = new Map<string, any>(
      included
        .filter((i: any) => i.type === "territories")
        .map((t: any) => [t.id, t]),
    );
    const ppMap = new Map<string, any>(
      included
        .filter((i: any) => i.type === "subscriptionPricePoints")
        .map((pp: any) => [pp.id, pp]),
    );
    res.json(
      (resp.data ?? []).map((p: any) => {
        const terrId = p.relationships?.territory?.data?.id ?? null;
        const ppId = p.relationships?.subscriptionPricePoint?.data?.id ?? null;
        const terr = terrId ? terrMap.get(terrId) : null;
        const pp = ppId ? ppMap.get(ppId) : null;
        return {
          id: p.id,
          territory: terrId,
          currency: terr?.attributes?.currency ?? null,
          customerPrice: pp?.attributes?.customerPrice ?? null,
          proceeds: pp?.attributes?.proceeds ?? null,
          pricePointId: ppId,
          startDate: p.attributes?.startDate ?? null,
          preserved: p.attributes?.preserved ?? false,
        };
      }),
    );
  } catch (err: any) {
    logger.error("ASC listSubscriptionPrices failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/subscriptions/prices", async (req, res) => {
  try {
    const {
      subscriptionId,
      pricePointId,
      territory,
      startDate,
      preserveCurrentPrice,
    } = req.body as {
      subscriptionId?: string;
      pricePointId?: string;
      territory?: string;
      startDate?: string | null;
      preserveCurrentPrice?: boolean;
    };
    if (!subscriptionId || !pricePointId) {
      res
        .status(400)
        .json({ error: "subscriptionId and pricePointId are required" });
      return;
    }
    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.post(
      "/subscriptionPrices",
      {
        data: {
          type: "subscriptionPrices",
          attributes: {
            ...(startDate !== undefined ? { startDate } : {}),
            ...(preserveCurrentPrice !== undefined
              ? { preserveCurrentPrice }
              : {}),
          },
          relationships: {
            subscription: {
              data: { type: "subscriptions", id: subscriptionId },
            },
            subscriptionPricePoint: {
              data: { type: "subscriptionPricePoints", id: pricePointId },
            },
            ...(territory
              ? { territory: { data: { type: "territories", id: territory } } }
              : {}),
          },
        },
      },
    );
    res.status(201).json({ id: resp.data.id, ok: true });
  } catch (err: any) {
    logger.error("ASC createSubscriptionPrice failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.delete("/subscriptions/prices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.delete(`/subscriptionPrices/${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC deleteSubscriptionPrice failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.get("/subscriptions/:id/review-screenshot", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    const { data: resp } = await (asc as any).client.get(
      `/subscriptions/${id}/appStoreReviewScreenshot`,
      {
        params: {
          "fields[subscriptionAppStoreReviewScreenshots]":
            "fileName,fileSize,sourceFileChecksum,imageAsset,assetToken,assetType,uploadOperations,assetDeliveryState",
        },
      },
    );
    if (!resp.data) {
      res.json(null);
      return;
    }
    const d = resp.data;
    const asset = d.attributes?.imageAsset ?? null;
    res.json({
      id: d.id,
      fileName: d.attributes?.fileName ?? null,
      fileSize: d.attributes?.fileSize ?? null,
      assetDeliveryState: d.attributes?.assetDeliveryState ?? null,
      imageUrl: asset?.templateUrl
        ? asset.templateUrl
            .replace("{w}", String(asset.width ?? 320))
            .replace("{h}", String(asset.height ?? 180))
            .replace("{f}", "png")
        : null,
      width: asset?.width ?? null,
      height: asset?.height ?? null,
    });
  } catch (err: any) {
    logger.error("ASC getSubscriptionReviewScreenshot failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.post("/subscriptions/:id/review-screenshot", async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileSize, fileData } = req.body as {
      fileName?: string;
      fileSize?: number;
      fileData?: string;
    };
    if (!fileName || !fileSize || !fileData) {
      res.status(400).json({ error: "fileName, fileSize and fileData are required" });
      return;
    }

    const asc = await ascClientForUser(req.user!.userId);

    const { data: createResp } = await (asc as any).client.post(
      "/subscriptionAppStoreReviewScreenshots",
      {
        data: {
          type: "subscriptionAppStoreReviewScreenshots",
          attributes: { fileName, fileSize },
          relationships: {
            subscription: { data: { type: "subscriptions", id } },
          },
        },
      },
    );

    const screenshotId = createResp.data.id;
    const uploadOps: any[] = createResp.data.attributes?.uploadOperations ?? [];
    const fileBytes = Buffer.from(fileData, "base64");

    for (const op of uploadOps) {
      const chunk = fileBytes.slice(op.offset, op.offset + op.length);
      await axios.put(op.url, chunk, {
        headers: Object.fromEntries(
          (op.requestHeaders ?? []).map((h: any) => [h.name, h.value]),
        ),
      });
    }

    await (asc as any).client.patch(
      `/subscriptionAppStoreReviewScreenshots/${screenshotId}`,
      {
        data: {
          type: "subscriptionAppStoreReviewScreenshots",
          id: screenshotId,
          attributes: { uploaded: true },
        },
      },
    );

    res.status(201).json({ id: screenshotId, ok: true });
  } catch (err: any) {
    logger.error("ASC createSubscriptionReviewScreenshot failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

ascRouter.delete("/subscriptions/review-screenshots/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const asc = await ascClientForUser(req.user!.userId);
    await (asc as any).client.delete(`/subscriptionAppStoreReviewScreenshots/${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("ASC deleteSubscriptionReviewScreenshot failed", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});
