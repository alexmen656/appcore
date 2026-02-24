import zlib from "zlib";
import axios from "axios";
import jwt from "jsonwebtoken";
import { prisma, logger } from "../config";
import type { EffectiveSettings } from "../config/userSettings";

function makeToken(settings: EffectiveSettings): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: settings.ascIssuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: "appstoreconnect-v1",
    },
    settings.ascPrivateKey,
    {
      algorithm: "ES256",
      header: { alg: "ES256", kid: settings.ascKeyId, typ: "JWT" },
    },
  );
}

function authHeaders(settings: EffectiveSettings) {
  return { Authorization: `Bearer ${makeToken(settings)}` };
}

function parseTsv(raw: string): Record<string, string>[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    return Object.fromEntries(
      headers.map((h, i) => [h.trim(), (cols[i] ?? "").trim()]),
    );
  });
}

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
  });
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchSalesReports(
  settings: EffectiveSettings,
  bundleId: string,
  daysBack = 60,
): Promise<number> {
  if (!settings.ascVendorNumber) {
    logger.warn("ASC vendor number not configured - skipping sales reports");
    return 0;
  }

  const headers = authHeaders(settings);
  let storedDays = 0;

  for (let i = 1; i <= daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = fmtDate(date);

    if (i > 2) {
      const existing = await prisma.appStoreAnalytics.findFirst({
        where: {
          bundleId,
          reportDate: new Date(dateStr),
        },
      });
      if (existing) continue;
    }

    try {
      const resp = await axios.get(
        `https://api.appstoreconnect.apple.com/v1/salesReports`,
        {
          headers: { ...headers, Accept: "application/a-gzip" },
          params: {
            "filter[frequency]": "DAILY",
            "filter[reportType]": "SALES",
            "filter[reportSubType]": "SUMMARY",
            "filter[vendorNumber]": settings.ascVendorNumber,
            "filter[reportDate]": dateStr,
          },
          responseType: "arraybuffer",
        },
      );

      const raw = zlib.gunzipSync(Buffer.from(resp.data)).toString("utf-8");
      const rows = parseTsv(raw);

      const byCountry: Record<
        string,
        {
          downloads: number;
          updates: number;
          proceeds: number;
        }
      > = {};

      for (const row of rows) {
        const typeId = row["Product Type Identifier"] ?? "";
        const units = parseInt(row["Units"] ?? "0", 10) || 0;
        const proceeds = parseFloat(row["Developer Proceeds"] ?? "0") || 0;
        const country = (row["Country Code"] ?? "").toUpperCase().trim();
        if (!country) continue;

        if (!byCountry[country]) {
          byCountry[country] = {
            downloads: 0,
            updates: 0,
            proceeds: 0,
          };
        }

        if (typeId === "1" || typeId === "1F") {
          byCountry[country].downloads += units;
          byCountry[country].proceeds += proceeds;
        } else if (typeId === "1T") {
          byCountry[country].updates += units;
        } else if (typeId === "7") {
          byCountry[country].proceeds += proceeds;
        }
      }

      const reportDate = new Date(dateStr);
      const countryCount = Object.keys(byCountry).length;
      for (const [country, agg] of Object.entries(byCountry)) {
        await prisma.appStoreAnalytics.upsert({
          where: {
            bundleId_reportDate_country: { bundleId, reportDate, country },
          },
          create: { bundleId, reportDate, country, ...agg },
          update: agg,
        });
      }

      if (countryCount > 0) {
        storedDays++;
        logger.debug(
          `Sales report stored: ${bundleId} ${dateStr} (${countryCount} countries)`,
        );
      }
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 400) {
        logger.debug(`No sales report for ${dateStr}`);
        continue;
      }
      logger.warn(
        `Sales report fetch failed for ${dateStr}: ${err?.message ?? err}`,
      );
    }
  }

  return storedDays;
}

// ─── Fetch App Store Engagement (impressions, page views, sessions) ───────────
// Uses Apple's Analytics Reports API v1 with ONGOING access type.
// The requestId is persisted in UserSettings after first creation so it
// is reused on every subsequent sync (Apple populates it with daily data).
export async function fetchEngagementReport(
  settings: EffectiveSettings,
  ascAppId: string,
  bundleId: string,
  daysBack = 60,
): Promise<{ rows: number; requestId: string | null }> {
  if (!ascAppId) {
    logger.warn("ASC App ID not configured – skipping engagement report fetch");
    return { rows: 0, requestId: null };
  }

  const headers = authHeaders(settings);
  const BASE = "https://api.appstoreconnect.apple.com/v1";

  // ── Step 1: Use persisted requestId or create a new ONGOING request ───────
  let requestId: string | null = settings.ascAnalyticsRequestId || null;

  if (!requestId) {
    try {
      const createResp = await axios.post(
        `${BASE}/analyticsReportRequests`,
        {
          data: {
            type: "analyticsReportRequests",
            attributes: { accessType: "ONGOING" },
            relationships: {
              app: { data: { type: "apps", id: ascAppId } },
            },
          },
        },
        { headers },
      );
      requestId = createResp.data?.data?.id ?? null;
      if (!requestId) throw new Error("No request ID in create response");
      logger.info(
        `Created ONGOING analytics report request ${requestId} for ${bundleId} – data will appear in the next sync.`,
      );
      // Return immediately – Apple hasn't generated any instances yet for a brand-new request.
      return { rows: 0, requestId };
    } catch (err: any) {
      logger.warn(
        `Creating analytics report request failed: ${err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? err)}`,
      );
      return { rows: 0, requestId: null };
    }
  }

  // ── Step 2: List all reports for this request ──────────────────────────────
  let reportIds: string[] = [];
  try {
    const reportsResp = await axios.get(
      `${BASE}/analyticsReportRequests/${requestId}/reports`,
      { headers },
    );
    const reports: any[] = reportsResp.data?.data ?? [];
    logger.debug(
      `Analytics request ${requestId}: ${reports.length} report(s) – ${reports.map((r) => r.attributes?.reportType).join(", ")}`,
    );
    // Accept any of the engagement-related report types Apple names
    const engagementTypes = new Set([
      "APP_STORE_ENGAGEMENT",
      "APP_STORE_DISCOVERY_AND_FUNNEL",
      "APP_STORE_INSTALLATION_AND_DELETION",
    ]);
    const relevant = reports.filter((r: any) =>
      engagementTypes.has(r.attributes?.reportType ?? ""),
    );
    // Fallback: use all if none matched (handles renamed types Apple may introduce)
    const pool = relevant.length > 0 ? relevant : reports;
    reportIds = pool.map((r: any) => r.id).filter(Boolean);
    if (reportIds.length === 0) {
      logger.info(
        `No engagement reports available yet for request ${requestId} (${bundleId}).`,
      );
      return { rows: 0, requestId };
    }
  } catch (err: any) {
    logger.warn(
      `Listing reports for request ${requestId}: ${err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? err)}`,
    );
    return { rows: 0, requestId };
  }

  // ── Step 3: Fetch daily instances and download segments ───────────────────
  const sinceCutoff = new Date();
  sinceCutoff.setDate(sinceCutoff.getDate() - daysBack);
  let storedRows = 0;

  for (const reportId of reportIds) {
    let instances: any[] = [];
    try {
      const instResp = await axios.get(
        `${BASE}/analyticsReports/${reportId}/instances`,
        { headers, params: { "filter[granularity]": "DAILY", limit: 200 } },
      );
      const all: any[] = instResp.data?.data ?? [];
      instances = all.filter((inst: any) => {
        const pd: string | undefined = inst.attributes?.processingDate;
        return !pd || new Date(pd) >= sinceCutoff;
      });
      logger.debug(
        `Report ${reportId}: ${all.length} total instances, ${instances.length} within daysBack=${daysBack}`,
      );
    } catch (err: any) {
      logger.warn(
        `Fetching instances for report ${reportId}: ${err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? err)}`,
      );
      continue;
    }

    for (const instance of instances) {
      let segmentUrls: string[] = [];
      try {
        const segResp = await axios.get(
          `${BASE}/analyticsReportInstances/${instance.id}/segments`,
          { headers },
        );
        segmentUrls = (segResp.data?.data ?? [])
          .map((s: any) => s.attributes?.url)
          .filter(Boolean);
      } catch (err: any) {
        logger.warn(
          `Fetching segments for instance ${instance.id}: ${err?.message ?? err}`,
        );
        continue;
      }

      for (const url of segmentUrls) {
        try {
          // Segment URLs are pre-signed – no Authorization header needed
          const dlResp = await axios.get(url, { responseType: "arraybuffer" });
          const raw = zlib
            .gunzipSync(Buffer.from(dlResp.data))
            .toString("utf-8");
          const rows = raw.includes("\t") ? parseTsv(raw) : parseCsv(raw);

          if (rows.length === 0) continue;

          // Log header names once per segment to help diagnose column naming
          logger.debug(
            `Engagement segment columns: ${Object.keys(rows[0]).join(" | ")}`,
          );

          const dayCountry: Record<
            string,
            { impressions: number; pageViews: number; sessions: number }
          > = {};

          for (const row of rows) {
            const dateStr = (
              row["Date"] ??
              row["date"] ??
              row["Report Date"] ??
              ""
            ).slice(0, 10);
            if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

            const territory =
              (
                row["Territory"] ??
                row["territory"] ??
                row["Country Code"] ??
                row["Region"] ??
                "WW"
              )
                .toUpperCase()
                .trim() || "WW";

            const key = `${dateStr}::${territory}`;
            if (!dayCountry[key])
              dayCountry[key] = { impressions: 0, pageViews: 0, sessions: 0 };

            dayCountry[key].impressions +=
              parseInt(
                row["Impressions"] ??
                  row["impressions"] ??
                  row["Total Impressions"] ??
                  row["Impressions Unique Devices"] ??
                  "0",
                10,
              ) || 0;
            dayCountry[key].pageViews +=
              parseInt(
                row["Product Page Views"] ??
                  row["productPageViews"] ??
                  row["Page Views"] ??
                  row["Product Page Views Unique Devices"] ??
                  "0",
                10,
              ) || 0;
            dayCountry[key].sessions +=
              parseInt(
                row["Sessions"] ??
                  row["sessions"] ??
                  row["Unique Device Sessions"] ??
                  row["Active Devices"] ??
                  "0",
                10,
              ) || 0;
          }

          for (const [key, metrics] of Object.entries(dayCountry)) {
            const [dateStr, country] = key.split("::");
            const reportDate = new Date(dateStr);
            await prisma.appStoreAnalytics.upsert({
              where: {
                bundleId_reportDate_country: { bundleId, reportDate, country },
              },
              create: { bundleId, reportDate, country, ...metrics },
              update: metrics,
            });
            storedRows++;
          }
        } catch (err: any) {
          logger.warn(
            `Downloading/parsing engagement segment: ${err?.message ?? err}`,
          );
        }
      }
    }
  }

  logger.info(
    `Engagement report: stored ${storedRows} rows for ${bundleId} (request: ${requestId})`,
  );
  return { rows: storedRows, requestId };
}

export async function fetchReviews(
  settings: EffectiveSettings,
  ascAppId: string,
  bundleId: string,
): Promise<number> {
  const headers = authHeaders(settings);
  let cursor: string | null = null;
  let total = 0;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, any> = {
      sort: "-createdDate",
      limit: 200,
      "fields[customerReviews]":
        "rating,title,body,reviewerNickname,territory,createdDate",
    };
    if (cursor) params["cursor"] = cursor;

    const resp = await axios.get(
      `https://api.appstoreconnect.apple.com/v1/apps/${ascAppId}/customerReviews`,
      {
        headers,
        params,
      },
    );

    const reviews: any[] = resp.data?.data ?? [];

    for (const r of reviews) {
      const attrs = r.attributes ?? {};
      await prisma.appReview.upsert({
        where: { ascReviewId: r.id },
        create: {
          ascReviewId: r.id,
          bundleId,
          rating: attrs.rating ?? 0,
          title: attrs.title ?? null,
          body: attrs.body ?? null,
          reviewerNickname: attrs.reviewerNickname ?? null,
          territory: attrs.territory ?? null,
          reviewedAt: new Date(attrs.createdDate ?? Date.now()),
        },
        update: {
          rating: attrs.rating ?? 0,
          title: attrs.title ?? null,
          body: attrs.body ?? null,
        },
      });
      total++;
    }

    const nextCursor = resp.data?.links?.next;
    if (!nextCursor || reviews.length === 0) break;
    try {
      const url = new URL(nextCursor);
      cursor = url.searchParams.get("cursor");
    } catch {
      break;
    }
  }

  return total;
}

export interface AnalyticsSyncResult {
  downloadDays: number;
  reviewsFetched: number;
  error?: string;
}

export async function syncAllAnalytics(
  settings: EffectiveSettings,
  bundleId: string,
  ascAppId: string,
  userId: string,
): Promise<AnalyticsSyncResult> {
  const job = await prisma.scrapeJob.create({
    data: { type: "ASC_ANALYTICS", status: "RUNNING", startedAt: new Date() },
  });

  try {
    const downloadDays = await fetchSalesReports(settings, bundleId, 365);

    let reviewsFetched = 0;
    if (ascAppId) {
      reviewsFetched = await fetchReviews(settings, ascAppId, bundleId);
    }

    let engagementRows = 0;
    if (ascAppId) {
      try {
        const result = await fetchEngagementReport(
          settings,
          ascAppId,
          bundleId,
          60,
        );
        engagementRows = result.rows;
        if (
          result.requestId &&
          result.requestId !== settings.ascAnalyticsRequestId
        ) {
          await prisma.userSettings.update({
            where: { userId },
            data: { ascAnalyticsRequestId: result.requestId },
          });
          logger.info(
            `Stored analytics request ID ${result.requestId} for user ${userId}`,
          );
        }
      } catch (err: any) {
        logger.warn(
          `Engagement report fetch error (non-fatal): ${err?.message ?? err}`,
        );
      }
    }

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        itemsCount: downloadDays + reviewsFetched,
        result: JSON.stringify({
          downloadDays,
          reviewsFetched,
          engagementRows,
        }),
      },
    });

    logger.info(
      `ASC analytics sync done: ${downloadDays} report-days, ${reviewsFetched} reviews, ${engagementRows} engagement rows`,
    );
    return { downloadDays, reviewsFetched };
  } catch (err: any) {
    const error = err?.message ?? String(err);
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: { status: "FAILED", completedAt: new Date(), error },
    });
    logger.error("ASC analytics sync failed", { error });
    return { downloadDays: 0, reviewsFetched: 0, error };
  }
}
