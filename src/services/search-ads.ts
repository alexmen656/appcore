import axios, { AxiosInstance } from "axios";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { logger, env } from "../config";

// ─── Apple Search Ads API Client ────────────────────────────────────────
// Docs: https://developer.apple.com/documentation/apple_search_ads
// Auth: OAuth2 client_credentials with JWT client_secret signed by EC key

interface SearchAdsToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface KeywordInsight {
  keyword: string;
  popularity: number; // 5-100 scale
  rankRange?: { low: number; high: number };
}

interface SearchTermSource {
  searchTermText: string;
  impressions: number;
  taps: number;
  conversions: number;
  avgCPA: number;
  avgCPT: number;
}

export class AppleSearchAdsClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.client = axios.create({
      baseURL: "https://api.searchads.apple.com/api/v5",
      headers: { "Content-Type": "application/json" },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await this.authenticate();
      config.headers.Authorization = `Bearer ${token}`;
      if (env.APPLE_ADS_ORG_ID) {
        config.headers["X-AP-Context"] = `orgId=${env.APPLE_ADS_ORG_ID}`;
      }
      return config;
    });
  }

  /**
   * Generate a JWT client_secret from the EC private key.
   * Apple Search Ads requires the client_secret to be a signed JWT (ES256).
   *
   * JWT Header: { alg: "ES256", kid: APPLE_ADS_KEY_ID }
   * JWT Payload: {
   *   sub: APPLE_ADS_CLIENT_ID,
   *   aud: "https://appleid.apple.com",
   *   iat: <now>,
   *   exp: <now + 180 days max>,
   *   iss: APPLE_ADS_TEAM_ID
   * }
   */
  private generateClientSecret(): string {
    const keyPath = path.resolve(
      env.APPLE_ADS_KEY_PATH || "./apple_ads_private_key.pem"
    );

    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `Search Ads private key not found at ${keyPath}. ` +
          `Download it from Apple Search Ads UI → Settings → API.`
      );
    }

    const privateKey = fs.readFileSync(keyPath, "utf8");
    const teamId = env.APPLE_ADS_TEAM_ID || env.APPLE_ADS_CLIENT_ID || "";
    const keyId = env.APPLE_ADS_KEY_ID || "";
    const clientId = env.APPLE_ADS_CLIENT_ID || "";

    if (!clientId) throw new Error("APPLE_ADS_CLIENT_ID is required");

    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 86400 * 180; // 180 days (Apple max)

    // Build JWT manually (Header.Payload.Signature)
    const header = {
      alg: "ES256",
      kid: keyId || undefined,
    };

    const payload = {
      sub: clientId,
      aud: "https://appleid.apple.com",
      iat: now,
      exp: expiry,
      iss: teamId,
    };

    const encodedHeader = this.base64url(JSON.stringify(header));
    const encodedPayload = this.base64url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with ES256 (ECDSA using P-256 and SHA-256)
    const sign = crypto.createSign("SHA256");
    sign.update(signingInput);
    const derSignature = sign.sign(privateKey);

    // Convert DER signature to raw r||s format for JWT
    const rawSignature = this.derToRaw(derSignature);
    const encodedSignature = this.base64url(rawSignature);

    return `${signingInput}.${encodedSignature}`;
  }

  private base64url(input: string | Buffer): string {
    const buf = typeof input === "string" ? Buffer.from(input) : input;
    return buf.toString("base64url");
  }

  /**
   * Convert DER-encoded ECDSA signature to raw r||s (64 bytes for P-256)
   */
  private derToRaw(derSig: Buffer): Buffer {
    // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
    let offset = 2; // skip 0x30 and total length
    if (derSig[1] & 0x80) offset += (derSig[1] & 0x7f); // long form length

    // Read r
    offset++; // skip 0x02
    const rLen = derSig[offset++];
    let r = derSig.subarray(offset, offset + rLen);
    offset += rLen;

    // Read s
    offset++; // skip 0x02
    const sLen = derSig[offset++];
    let s = derSig.subarray(offset, offset + sLen);

    // Trim leading zeros (DER uses minimal encoding, but may have leading 0x00 for sign)
    if (r.length > 32) r = r.subarray(r.length - 32);
    if (s.length > 32) s = s.subarray(s.length - 32);

    // Pad to 32 bytes each
    const raw = Buffer.alloc(64);
    r.copy(raw, 32 - r.length);
    s.copy(raw, 64 - s.length);
    return raw;
  }

  /**
   * OAuth2 client credentials flow for Search Ads.
   * The client_secret is a JWT signed with our EC private key.
   */
  private async authenticate(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiry > now + 60000) {
      return this.accessToken;
    }

    if (!env.APPLE_ADS_CLIENT_ID) {
      throw new Error(
        "Apple Search Ads credentials missing. Set APPLE_ADS_CLIENT_ID."
      );
    }

    // Generate JWT client_secret from private key
    const clientSecret = this.generateClientSecret();

    const { data } = await axios.post<SearchAdsToken>(
      "https://appleid.apple.com/auth/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.APPLE_ADS_CLIENT_ID,
        client_secret: clientSecret,
        scope: "searchadsorg",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    this.accessToken = data.access_token;
    this.tokenExpiry = now + data.expires_in * 1000;

    logger.info("Authenticated with Apple Search Ads API");
    return this.accessToken;
  }

  // ─── Keyword Research ──────────────────────────────────────────────

  /**
   * Get keyword recommendations for an app
   */
  async getTargetingKeywords(
    appId: string,
    limit = 50
  ): Promise<KeywordInsight[]> {
    // Try recommended keywords first (works without active campaigns)
    const recommended = await this.getRecommendedKeywords(appId, limit);
    if (recommended.length > 0) return recommended;

    // Fall back to targeting keywords (requires active campaign)
    try {
      const { data } = await this.client.post(
        "/keywords/targeting",
        {
          appId,
          limit,
        }
      );

      return (
        data.data?.map((kw: any) => ({
          keyword: kw.text,
          popularity: kw.popularity ?? 0,
        })) ?? []
      );
    } catch (error) {
      logger.warn("Failed to get targeting keywords", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  /**
   * Get keyword recommendations for an app (works without active campaigns)
   */
  async getRecommendedKeywords(
    appId: string,
    limit = 50
  ): Promise<KeywordInsight[]> {
    try {
      const { data } = await this.client.post(
        "/keywords/recommended",
        {
          appId,
          limit,
        }
      );

      const results =
        data.data?.map((kw: any) => ({
          keyword: kw.text ?? kw.keyword,
          popularity: kw.popularity ?? 0,
        })) ?? [];

      if (results.length > 0) {
        logger.info(`Got ${results.length} recommended keywords from Search Ads`);
      }
      return results;
    } catch (error) {
      logger.debug("Recommended keywords not available", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  /**
   * Get search term impressions/performance from campaigns
   */
  async getSearchTermReport(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<SearchTermSource[]> {
    try {
      const { data } = await this.client.post(
        `/reports/campaigns/${campaignId}/searchterms`,
        {
          startTime: startDate,
          endTime: endDate,
          granularity: "DAILY",
          selector: {
            pagination: { offset: 0, limit: 100 },
          },
        }
      );

      return (
        data.data?.reportingDataResponse?.row?.map((row: any) => ({
          searchTermText: row.metadata?.searchTermText ?? "",
          impressions: row.total?.impressions ?? 0,
          taps: row.total?.taps ?? 0,
          conversions: row.total?.conversions ?? 0,
          avgCPA: row.total?.avgCPA?.amount ?? 0,
          avgCPT: row.total?.avgCPT?.amount ?? 0,
        })) ?? []
      );
    } catch (error) {
      logger.warn("Failed to get search term report", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  // ─── Campaign insights ────────────────────────────────────────────

  /**
   * Get all campaigns for our organization
   */
  async getCampaigns(): Promise<any[]> {
    try {
      const { data } = await this.client.get("/campaigns", {
        params: { limit: 100 },
      });
      return data.data ?? [];
    } catch (error) {
      logger.warn("Failed to get campaigns", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  /**
   * Get keyword-level performance data
   */
  async getKeywordReport(
    campaignId: string,
    adGroupId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const { data } = await this.client.post(
        `/reports/campaigns/${campaignId}/adgroups/${adGroupId}/keywords`,
        {
          startTime: startDate,
          endTime: endDate,
          granularity: "DAILY",
          selector: {
            pagination: { offset: 0, limit: 200 },
          },
        }
      );
      return data.data?.reportingDataResponse?.row ?? [];
    } catch (error) {
      logger.warn("Failed to get keyword report", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }
}
