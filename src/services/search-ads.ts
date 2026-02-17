import axios, { AxiosInstance } from "axios";
import { logger, env } from "../config";

// ─── Apple Search Ads API Client ────────────────────────────────────────
// Docs: https://developer.apple.com/documentation/apple_search_ads

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
   * OAuth2 client credentials flow for Search Ads
   */
  private async authenticate(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiry > now + 60000) {
      return this.accessToken;
    }

    if (!env.APPLE_ADS_CLIENT_ID || !env.APPLE_ADS_CLIENT_SECRET) {
      throw new Error(
        "Apple Search Ads credentials missing. Set APPLE_ADS_CLIENT_ID and APPLE_ADS_CLIENT_SECRET."
      );
    }

    const { data } = await axios.post<SearchAdsToken>(
      "https://appleid.apple.com/auth/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.APPLE_ADS_CLIENT_ID,
        client_secret: env.APPLE_ADS_CLIENT_SECRET,
        scope: "searchadsorg",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    this.accessToken = data.access_token;
    this.tokenExpiry = now + data.expires_in * 1000;

    logger.debug("Authenticated with Apple Search Ads API");
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
