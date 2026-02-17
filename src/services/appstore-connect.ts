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

export class AppStoreConnectClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private readonly issuerId: string;
  private readonly keyId: string;
  private readonly privateKey: string;

  constructor() {
    if (!env.ASC_ISSUER_ID || !env.ASC_KEY_ID) {
      throw new Error(
        "App Store Connect credentials missing. Set ASC_ISSUER_ID and ASC_KEY_ID."
      );
    }

    this.issuerId = env.ASC_ISSUER_ID;
    this.keyId = env.ASC_KEY_ID;

    try {
      this.privateKey = fs.readFileSync(env.ASC_PRIVATE_KEY_PATH, "utf-8");
    } catch {
      throw new Error(
        `Cannot read ASC private key at ${env.ASC_PRIVATE_KEY_PATH}`
      );
    }

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

  // ─── Convenience: Get full current ASO state ──────────────────────

  /**
   * Fetch the complete current ASO metadata for our app
   */
  async getCurrentASOState(locale = "de-DE"): Promise<{
    title?: string;
    subtitle?: string;
    description?: string;
    keywords?: string;
    whatsNew?: string;
    promotionalText?: string;
    appInfoLocalizationId?: string;
    versionLocalizationId?: string;
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

    const liveVersion = await this.getLiveVersion(app.id);
    let versionLoc: ASCVersionLocalization | undefined;
    if (liveVersion) {
      const versionLocalizations = await this.getVersionLocalizations(
        liveVersion.id,
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
    };
  }
}
