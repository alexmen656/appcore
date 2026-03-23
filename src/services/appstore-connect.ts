import jwt from "jsonwebtoken";
import fs from "fs";
import axios, { AxiosInstance } from "axios";
import { logger, env } from "../config";

interface ASCAppInfo {
  id: string;
  type: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
  };
}

interface ASCAppInfoLocalization {
  id: string;
  attributes: {
    locale: string;
    name: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
  };
}

interface ASCAppStoreVersion {
  id: string;
  attributes: {
    versionString: string;
    appStoreState: string;
    platform: string;
    releaseType: string;
  };
}

interface ASCVersionLocalization {
  id: string;
  attributes: {
    locale: string;
    description?: string;
    keywords?: string;
    whatsNew?: string;
    promotionalText?: string;
    marketingUrl?: string;
    supportUrl?: string;
  };
}

export interface ASCCredentials {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export class AppStoreConnectClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private readonly issuerId: string;
  private readonly keyId: string;
  private readonly privateKey: string;

  constructor(override?: Partial<ASCCredentials>) {
    const issuerId = override?.issuerId;
    const keyId = override?.keyId;
    const privateKey = override?.privateKey;

    if (!issuerId || !keyId || !privateKey) {
      throw new Error("App Store Connect credentials missing.");
    }

    this.issuerId = issuerId;
    this.keyId = keyId;
    this.privateKey = privateKey;

    this.client = axios.create({
      baseURL: "https://api.appstoreconnect.apple.com/v1",
      headers: { "Content-Type": "application/json" },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  private async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (this.token && this.tokenExpiry > now + 60) {
      return this.token;
    }

    const payload = {
      iss: this.issuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: "appstoreconnect-v1",
    };

    this.token = jwt.sign(payload, this.privateKey, {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: this.keyId,
        typ: "JWT",
      },
    });
    this.tokenExpiry = now + 20 * 60;

    logger.debug("Generated new ASC JWT token");
    return this.token;
  }

  async listApps(): Promise<ASCAppInfo[]> {
    const { data } = await this.client.get("/apps", {
      params: {
        "fields[apps]": "name,bundleId,sku,primaryLocale",
        limit: 200,
      },
    });
    return data.data ?? [];
  }

  async getApp(bundleId?: string): Promise<ASCAppInfo | null> {
    const bid = bundleId;
    const { data } = await this.client.get("/apps", {
      params: {
        "filter[bundleId]": bid,
        "fields[apps]": "name,bundleId,sku,primaryLocale",
      },
    });
    return data.data?.[0] ?? null;
  }

  async getAppInfoLocalizations(
    appId: string,
    appInfoId?: string,
  ): Promise<ASCAppInfoLocalization[]> {
    let resolvedAppInfoId = appInfoId;
    if (!resolvedAppInfoId) {
      resolvedAppInfoId = await this.getAppInfoId(appId);
    }
    if (!resolvedAppInfoId) return [];

    const { data } = await this.client.get(
      `/appInfos/${resolvedAppInfoId}/appInfoLocalizations`,
      {
        params: {
          "fields[appInfoLocalizations]":
            "locale,name,subtitle,privacyPolicyUrl",
        },
      },
    );

    return data.data ?? [];
  }

  async getLiveVersion(appId: string): Promise<ASCAppStoreVersion | null> {
    const { data } = await this.client.get(`/apps/${appId}/appStoreVersions`, {
      params: {
        "filter[appStoreState]": "READY_FOR_SALE",
        "filter[platform]": "IOS",
        "fields[appStoreVersions]":
          "versionString,appStoreState,platform,releaseType",
      },
    });
    return data.data?.[0] ?? null;
  }

  async listVersions(appId: string): Promise<ASCAppStoreVersion[]> {
    const { data } = await this.client.get(`/apps/${appId}/appStoreVersions`, {
      params: {
        "filter[platform]": "IOS",
        "fields[appStoreVersions]":
          "versionString,appStoreState,platform,releaseType",
        limit: 50,
      },
    });
    return data.data ?? [];
  }

  async getVersionLocalizations(
    versionId: string,
    locale?: string,
  ): Promise<ASCVersionLocalization[]> {
    const params: Record<string, string> = {
      "fields[appStoreVersionLocalizations]":
        "locale,description,keywords,whatsNew,promotionalText,marketingUrl,supportUrl",
    };
    if (locale) {
      params["filter[locale]"] = locale;
    }

    const { data } = await this.client.get(
      `/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
      { params },
    );

    return data.data ?? [];
  }

  private throwASCError(err: any): never {
    const ascErrors = err?.response?.data?.errors;
    if (ascErrors?.length) {
      const detail = ascErrors
        .map((e: any) => e.detail ?? e.title ?? JSON.stringify(e))
        .join("; ");
      throw new Error(`ASC ${err.response.status}: ${detail}`);
    }
    throw err;
  }

  async updateAppInfoLocalization(
    localizationId: string,
    updates: { name?: string; subtitle?: string; privacyPolicyUrl?: string },
  ): Promise<void> {
    try {
      await this.client.patch(`/appInfoLocalizations/${localizationId}`, {
        data: {
          type: "appInfoLocalizations",
          id: localizationId,
          attributes: updates,
        },
      });
      logger.info(`Updated app info localization ${localizationId}`, updates);
    } catch (err: any) {
      this.throwASCError(err);
    }
  }

  async updateVersionLocalization(
    localizationId: string,
    updates: {
      description?: string;
      keywords?: string;
      whatsNew?: string;
      promotionalText?: string;
      supportUrl?: string;
    },
  ): Promise<void> {
    try {
      await this.client.patch(
        `/appStoreVersionLocalizations/${localizationId}`,
        {
          data: {
            type: "appStoreVersionLocalizations",
            id: localizationId,
            attributes: updates,
          },
        },
      );
      logger.info(`Updated version localization ${localizationId}`, updates);
    } catch (err: any) {
      this.throwASCError(err);
    }
  }

  async getAppInfoId(appId: string): Promise<string | null> {
    const { data } = await this.client.get(`/apps/${appId}/appInfos`, {
      params: { "fields[appInfos]": "appStoreState" },
    });
    const infos: any[] = data.data ?? [];
    const editableStates = new Set([
      "PREPARE_FOR_SUBMISSION",
      "DEVELOPER_REJECTED",
      "REJECTED",
      "METADATA_REJECTED",
      "WAITING_FOR_REVIEW",
      "WAITING_FOR_EXPORT_COMPLIANCE",
      "PENDING_DEVELOPER_RELEASE",
      "IN_REVIEW",
    ]);
    const editable = infos.find((i) =>
      editableStates.has(i.attributes?.appStoreState),
    );
    return editable?.id ?? infos[0]?.id ?? null;
  }

  async createAppInfoLocalization(
    appInfoId: string,
    locale: string,
    name: string,
  ): Promise<ASCAppInfoLocalization> {
    try {
      const { data } = await this.client.post("/appInfoLocalizations", {
        data: {
          type: "appInfoLocalizations",
          attributes: { locale, name },
          relationships: {
            appInfo: { data: { type: "appInfos", id: appInfoId } },
          },
        },
      });
      return data.data;
    } catch (err: any) {
      this.throwASCError(err);
    }
  }

  async createVersionLocalization(
    versionId: string,
    locale: string,
  ): Promise<ASCVersionLocalization> {
    try {
      const { data } = await this.client.post("/appStoreVersionLocalizations", {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale },
          relationships: {
            appStoreVersion: {
              data: { type: "appStoreVersions", id: versionId },
            },
          },
        },
      });
      return data.data;
    } catch (err: any) {
      this.throwASCError(err);
    }
  }

  async deleteAppInfoLocalization(localizationId: string): Promise<void> {
    try {
      await this.client.delete(`/appInfoLocalizations/${localizationId}`);
    } catch (err: any) {
      if (err?.response?.status === 500) return;
      this.throwASCError(err);
    }
  }

  async deleteVersionLocalization(localizationId: string): Promise<void> {
    try {
      await this.client.delete(
        `/appStoreVersionLocalizations/${localizationId}`,
      );
    } catch (err: any) {
      if (err?.response?.status === 500) return;
      this.throwASCError(err);
    }
  }

  async getEditableVersion(appId: string): Promise<ASCAppStoreVersion | null> {
    const editableStates = [
      "PREPARE_FOR_SUBMISSION",
      "DEVELOPER_REJECTED",
      "REJECTED",
      "METADATA_REJECTED",
      "WAITING_FOR_REVIEW",
    ];

    const results = await Promise.all(
      editableStates.map((state) =>
        this.client
          .get(`/apps/${appId}/appStoreVersions`, {
            params: {
              "filter[appStoreState]": state,
              "filter[platform]": "IOS",
              "fields[appStoreVersions]":
                "versionString,appStoreState,platform,releaseType",
            },
          })
          .then(({ data }) => data.data?.[0] ?? null)
          .catch(() => null),
      ),
    );

    return results.find(Boolean) ?? null;
  }

  async createNewVersion(
    appId: string,
    versionString: string,
    releaseType: "MANUAL" | "AFTER_APPROVAL" = "MANUAL",
  ): Promise<ASCAppStoreVersion> {
    const { data } = await this.client.post("/appStoreVersions", {
      data: {
        type: "appStoreVersions",
        attributes: {
          versionString,
          platform: "IOS",
          releaseType,
        },
        relationships: {
          app: {
            data: { type: "apps", id: appId },
          },
        },
      },
    });

    logger.info(
      `Created new App Store version ${versionString} (${data.data.id})`,
    );
    return data.data;
  }

  async getOrCreateEditableVersion(appId: string): Promise<ASCAppStoreVersion> {
    const editable = await this.getEditableVersion(appId);
    if (editable) {
      logger.info(
        `Found editable version: ${editable.attributes.versionString} (${editable.attributes.appStoreState})`,
      );
      return editable;
    }

    const live = await this.getLiveVersion(appId);
    let nextVersion = "1.0.1";
    if (live) {
      const parts = live.attributes.versionString.split(".").map(Number);
      parts[parts.length - 1]++;
      nextVersion = parts.join(".");
    }

    logger.info(`No editable version found. Creating v${nextVersion}...`);
    return this.createNewVersion(appId, nextVersion);
  }

  async getCurrentASOState(locale = "en-US"): Promise<{
    title?: string;
    subtitle?: string;
    description?: string;
    keywords?: string;
    whatsNew?: string;
    promotionalText?: string;
    supportUrl?: string;
    marketingUrl?: string;
    appInfoLocalizationId?: string;
    versionLocalizationId?: string;
    appId?: string;
    versionId?: string;
    versionString?: string;
    appStoreState?: string;
  } | null> {
    const app = await this.getApp();
    if (!app) {
      logger.error("Own app not found in App Store Connect");
      return null;
    }

    const infoLocalizations = await this.getAppInfoLocalizations(app.id);
    const infoLoc = infoLocalizations.find(
      (l) => l.attributes.locale === locale,
    );

    let version = await this.getEditableVersion(app.id);
    if (!version) {
      version = await this.getLiveVersion(app.id);
    }

    let versionLoc: ASCVersionLocalization | undefined;
    if (version) {
      const versionLocalizations = await this.getVersionLocalizations(
        version.id,
        locale,
      );
      versionLoc = versionLocalizations[0];
    }

    return {
      title: infoLoc?.attributes.name,
      subtitle: infoLoc?.attributes.subtitle,
      description: versionLoc?.attributes.description,
      keywords: versionLoc?.attributes.keywords,
      whatsNew: versionLoc?.attributes.whatsNew,
      promotionalText: versionLoc?.attributes.promotionalText,
      supportUrl: versionLoc?.attributes.supportUrl,
      marketingUrl: versionLoc?.attributes.marketingUrl,
      appInfoLocalizationId: infoLoc?.id,
      versionLocalizationId: versionLoc?.id,
      appId: app.id,
      versionId: version?.id,
      versionString: version?.attributes.versionString,
      appStoreState: version?.attributes.appStoreState,
    };
  }

  async applyASOChanges(
    changes: {
      title?: string;
      subtitle?: string;
      description?: string;
      keywords?: string;
      whatsNew?: string;
      promotionalText?: string;
    },
    locale = "en-US",
  ): Promise<{
    applied: string[];
    errors: string[];
    versionId: string;
    versionString: string;
  }> {
    const applied: string[] = [];
    const errors: string[] = [];

    const app = await this.getApp();
    if (!app) {
      throw new Error("App not found in App Store Connect");
    }

    const version = await this.getOrCreateEditableVersion(app.id);
    const versionId = version.id;
    const versionString = version.attributes.versionString;

    logger.info(
      `Applying ASO changes to version ${versionString} (${version.attributes.appStoreState})`,
    );

    if (changes.title || changes.subtitle) {
      try {
        const infoLocalizations = await this.getAppInfoLocalizations(app.id);
        const infoLoc = infoLocalizations.find(
          (l) => l.attributes.locale === locale,
        );

        if (infoLoc) {
          const updates: { name?: string; subtitle?: string } = {};
          if (changes.title) updates.name = changes.title;
          if (changes.subtitle) updates.subtitle = changes.subtitle;

          await this.updateAppInfoLocalization(infoLoc.id, updates);

          if (changes.title) applied.push(`Title → "${changes.title}"`);
          if (changes.subtitle)
            applied.push(`Subtitle → "${changes.subtitle}"`);
        } else {
          errors.push(
            `No appInfoLocalization found for locale "${locale}". Available: ${infoLocalizations.map((l) => l.attributes.locale).join(", ")}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (changes.title) errors.push(`Title update failed: ${msg}`);
        if (changes.subtitle) errors.push(`Subtitle update failed: ${msg}`);
      }
    }

    if (
      changes.description ||
      changes.keywords ||
      changes.whatsNew ||
      changes.promotionalText
    ) {
      try {
        const versionLocs = await this.getVersionLocalizations(
          versionId,
          locale,
        );
        const versionLoc = versionLocs[0];

        if (versionLoc) {
          const updates: {
            description?: string;
            keywords?: string;
            whatsNew?: string;
            promotionalText?: string;
          } = {};
          if (changes.description) updates.description = changes.description;
          if (changes.keywords) updates.keywords = changes.keywords;
          if (changes.whatsNew) updates.whatsNew = changes.whatsNew;
          if (changes.promotionalText)
            updates.promotionalText = changes.promotionalText;

          await this.updateVersionLocalization(versionLoc.id, updates);

          if (changes.description) applied.push("Description updated");
          if (changes.keywords)
            applied.push(`Keywords → "${changes.keywords}"`);
          if (changes.whatsNew) applied.push("What's New updated");
          if (changes.promotionalText) applied.push("Promotional Text updated");
        } else {
          errors.push(
            `No versionLocalization found for locale "${locale}" on version ${versionString}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Version localization update failed: ${msg}`);
      }
    }

    return { applied, errors, versionId, versionString };
  }

  async submitForReview(versionId: string): Promise<void> {
    await this.client.post("/appStoreVersionSubmissions", {
      data: {
        type: "appStoreVersionSubmissions",
        relationships: {
          appStoreVersion: {
            data: { type: "appStoreVersions", id: versionId },
          },
        },
      },
    });
    logger.info(`Submitted version ${versionId} for App Review`);
  }
}
