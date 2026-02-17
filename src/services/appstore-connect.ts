import jwt from "jsonwebtoken";
import fs from "fs";
import axios, { AxiosInstance } from "axios";
import { logger, env } from "../config";

// ─── App Store Connect API Client ───────────────────────────────────────
// Docs: https://developer.apple.com/documentation/appstoreconnectapi

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
  /** PEM key content (not a file path) */
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
    const issuerId  = override?.issuerId  ?? env.ASC_ISSUER_ID;
    const keyId     = override?.keyId     ?? env.ASC_KEY_ID;
    let   privateKey = override?.privateKey;

    if (!issuerId || !keyId) {
      throw new Error(
        "App Store Connect credentials missing. Provide issuerId and keyId."
      );
    }

    if (!privateKey) {
      try {
        privateKey = fs.readFileSync(env.ASC_PRIVATE_KEY_PATH, "utf-8");
      } catch {
        throw new Error(
          `Cannot read ASC private key at ${env.ASC_PRIVATE_KEY_PATH}`
        );
      }
    }

    this.issuerId  = issuerId;
    this.keyId     = keyId;
    this.privateKey = privateKey;

    this.client = axios.create({
      baseURL: "https://api.appstoreconnect.apple.com/v1",
      headers: { "Content-Type": "application/json" },
    });

    // Attach auth token to every request
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * Generate a JWT for App Store Connect API
   */
  private async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // Reuse token if still valid (with 60s buffer)
    if (this.token && this.tokenExpiry > now + 60) {
      return this.token;
    }

    const payload = {
      iss: this.issuerId,
      iat: now,
      exp: now + 20 * 60, // 20 minutes
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

  // ─── App Info ──────────────────────────────────────────────────────

  /**
   * List all apps accessible via the API key
   */
  async listApps(): Promise<ASCAppInfo[]> {
    const { data } = await this.client.get("/apps", {
      params: {
        "fields[apps]": "name,bundleId,sku,primaryLocale",
        limit: 200,
      },
    });
    return data.data ?? [];
  }

  /**
   * Get app by bundle ID
   */
  async getApp(bundleId?: string): Promise<ASCAppInfo | null> {
    const bid = bundleId ?? env.ASC_BUNDLE_ID;
    const { data } = await this.client.get("/apps", {
      params: {
        "filter[bundleId]": bid,
        "fields[apps]": "name,bundleId,sku,primaryLocale",
      },
    });
    return data.data?.[0] ?? null;
  }

  /**
   * Get app info localizations (title, subtitle per locale)
   */
  async getAppInfoLocalizations(
    appId: string
  ): Promise<ASCAppInfoLocalization[]> {
    // First get the appInfo
    const { data: appInfos } = await this.client.get(
      `/apps/${appId}/appInfos`,
      { params: { "fields[appInfos]": "appStoreState" } }
    );

    const appInfoId = appInfos.data?.[0]?.id;
    if (!appInfoId) return [];

    const { data } = await this.client.get(
      `/appInfos/${appInfoId}/appInfoLocalizations`,
      {
        params: {
          "fields[appInfoLocalizations]": "locale,name,subtitle",
        },
      }
    );

    return data.data ?? [];
  }

  // ─── App Store Versions ────────────────────────────────────────────

  /**
   * Get the current live App Store version
   */
  async getLiveVersion(appId: string): Promise<ASCAppStoreVersion | null> {
    const { data } = await this.client.get(
      `/apps/${appId}/appStoreVersions`,
      {
        params: {
          "filter[appStoreState]": "READY_FOR_SALE",
          "filter[platform]": "IOS",
          "fields[appStoreVersions]":
            "versionString,appStoreState,platform,releaseType",
        },
      }
    );
    return data.data?.[0] ?? null;
  }

  /**
   * Get version localizations (description, keywords, etc.)
   */
  async getVersionLocalizations(
    versionId: string,
    locale?: string
  ): Promise<ASCVersionLocalization[]> {
    const params: Record<string, string> = {
      "fields[appStoreVersionLocalizations]":
        "locale,description,keywords,whatsNew,promotionalText",
    };
    if (locale) {
      params["filter[locale]"] = locale;
    }

    const { data } = await this.client.get(
      `/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
      { params }
    );

    return data.data ?? [];
  }

  // ─── Update Operations ────────────────────────────────────────────

  /**
   * Update app info localization (title, subtitle)
   */
  async updateAppInfoLocalization(
    localizationId: string,
    updates: { name?: string; subtitle?: string }
  ): Promise<void> {
    await this.client.patch(`/appInfoLocalizations/${localizationId}`, {
      data: {
        type: "appInfoLocalizations",
        id: localizationId,
        attributes: updates,
      },
    });
    logger.info(`Updated app info localization ${localizationId}`, updates);
  }

  /**
   * Update version localization (description, keywords, whatsNew)
   */
  async updateVersionLocalization(
    localizationId: string,
    updates: {
      description?: string;
      keywords?: string;
      whatsNew?: string;
      promotionalText?: string;
    }
  ): Promise<void> {
    await this.client.patch(
      `/appStoreVersionLocalizations/${localizationId}`,
      {
        data: {
          type: "appStoreVersionLocalizations",
          id: localizationId,
          attributes: updates,
        },
      }
    );
    logger.info(`Updated version localization ${localizationId}`, updates);
  }

  // ─── Editable Version Handling ──────────────────────────────────

  /**
   * Get an editable App Store version (PREPARE_FOR_SUBMISSION or IN_REVIEW).
   * If none exists, returns null — you'd need to create a new version.
   */
  async getEditableVersion(appId: string): Promise<ASCAppStoreVersion | null> {
    const editableStates = [
      "PREPARE_FOR_SUBMISSION",
      "DEVELOPER_REJECTED",
      "REJECTED",
      "METADATA_REJECTED",
      "WAITING_FOR_REVIEW",
    ];

    for (const state of editableStates) {
      const { data } = await this.client.get(
        `/apps/${appId}/appStoreVersions`,
        {
          params: {
            "filter[appStoreState]": state,
            "filter[platform]": "IOS",
            "fields[appStoreVersions]":
              "versionString,appStoreState,platform,releaseType",
          },
        }
      );
      if (data.data?.length > 0) {
        return data.data[0];
      }
    }
    return null;
  }

  /**
   * Create a new App Store version for editing
   */
  async createNewVersion(
    appId: string,
    versionString: string,
    releaseType: "MANUAL" | "AFTER_APPROVAL" = "MANUAL"
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
      `Created new App Store version ${versionString} (${data.data.id})`
    );
    return data.data;
  }

  /**
   * Get or create an editable version. If there's a live version, bumps the patch.
   */
  async getOrCreateEditableVersion(
    appId: string
  ): Promise<ASCAppStoreVersion> {
    // Try to find an existing editable version
    const editable = await this.getEditableVersion(appId);
    if (editable) {
      logger.info(
        `Found editable version: ${editable.attributes.versionString} (${editable.attributes.appStoreState})`
      );
      return editable;
    }

    // Get live version to determine next version number
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

  // ─── Convenience: Get full current ASO state ──────────────────────

  /**
   * Fetch the complete current ASO metadata for our app
   */
  async getCurrentASOState(locale = "en-US"): Promise<{
    title?: string;
    subtitle?: string;
    description?: string;
    keywords?: string;
    whatsNew?: string;
    promotionalText?: string;
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
      (l) => l.attributes.locale === locale
    );

    // Try editable version first, then live
    let version = await this.getEditableVersion(app.id);
    if (!version) {
      version = await this.getLiveVersion(app.id);
    }

    let versionLoc: ASCVersionLocalization | undefined;
    if (version) {
      const versionLocalizations = await this.getVersionLocalizations(
        version.id,
        locale
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
      appInfoLocalizationId: infoLoc?.id,
      versionLocalizationId: versionLoc?.id,
      appId: app.id,
      versionId: version?.id,
      versionString: version?.attributes.versionString,
      appStoreState: version?.attributes.appStoreState,
    };
  }

  // ─── Apply ASO changes ────────────────────────────────────────────

  /**
   * Apply a set of ASO changes to the app.
   * Finds/creates an editable version and updates localizations.
   */
  async applyASOChanges(
    changes: {
      title?: string;
      subtitle?: string;
      description?: string;
      keywords?: string;
      whatsNew?: string;
      promotionalText?: string;
    },
    locale = "en-US"
  ): Promise<{
    applied: string[];
    errors: string[];
    versionId: string;
    versionString: string;
  }> {
    const applied: string[] = [];
    const errors: string[] = [];

    // Get app
    const app = await this.getApp();
    if (!app) {
      throw new Error("App not found in App Store Connect");
    }

    // Get or create editable version
    const version = await this.getOrCreateEditableVersion(app.id);
    const versionId = version.id;
    const versionString = version.attributes.versionString;

    logger.info(
      `Applying ASO changes to version ${versionString} (${version.attributes.appStoreState})`
    );

    // ── Update title/subtitle via appInfoLocalizations ──────────
    if (changes.title || changes.subtitle) {
      try {
        const infoLocalizations = await this.getAppInfoLocalizations(app.id);
        const infoLoc = infoLocalizations.find(
          (l) => l.attributes.locale === locale
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
            `No appInfoLocalization found for locale "${locale}". Available: ${infoLocalizations.map((l) => l.attributes.locale).join(", ")}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (changes.title) errors.push(`Title update failed: ${msg}`);
        if (changes.subtitle) errors.push(`Subtitle update failed: ${msg}`);
      }
    }

    // ── Update description/keywords/whatsNew via versionLocalizations ──
    if (
      changes.description ||
      changes.keywords ||
      changes.whatsNew ||
      changes.promotionalText
    ) {
      try {
        const versionLocs = await this.getVersionLocalizations(
          versionId,
          locale
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
          if (changes.keywords) applied.push(`Keywords → "${changes.keywords}"`);
          if (changes.whatsNew) applied.push("What's New updated");
          if (changes.promotionalText)
            applied.push("Promotional Text updated");
        } else {
          errors.push(
            `No versionLocalization found for locale "${locale}" on version ${versionString}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Version localization update failed: ${msg}`);
      }
    }

    return { applied, errors, versionId, versionString };
  }
}
