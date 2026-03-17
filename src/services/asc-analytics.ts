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
  ascAppId: string,
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
        const rowAppId = (row["Apple Identifier"] ?? "").trim();
        if (ascAppId && rowAppId && rowAppId !== ascAppId) continue;

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
      const countryEntries = Object.entries(byCountry);
      if (countryEntries.length > 0) {
        await Promise.all(
          countryEntries.map(([country, agg]) =>
            prisma.appStoreAnalytics.upsert({
              where: {
                bundleId_reportDate_country: { bundleId, reportDate, country },
              },
              create: { bundleId, reportDate, country, ...agg },
              update: agg,
            }),
          ),
        );
        storedDays++;
        logger.debug(
          `Sales report stored: ${bundleId} ${dateStr} (${countryEntries.length} countries)`,
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

/**
 * Fetch and store all APP_STORE_ENGAGEMENT report data from a single analytics
 * report request (works for both ONGOING and ONE_TIME_SNAPSHOT requests).
 *
 * The "App Store Discovery and Engagement" report is an event-log format:
 *   Date | Event | Page Type | Source Type | Territory | Counts | Unique Counts
 * "Impressions" = rows where Event == "Impression", summed via Counts.
 * "Page views"  = rows where Event == "Page view",  summed via Counts.
 */
async function processAnalyticsRequest(
  settings: EffectiveSettings,
  bundleId: string,
  requestId: string,
  daysBack: number,
): Promise<number> {
  const headers = authHeaders(settings);
  const BASE = "https://api.appstoreconnect.apple.com/v1";
  const sinceCutoff = new Date();
  sinceCutoff.setDate(sinceCutoff.getDate() - daysBack);

  // --- 1. List reports for this request, keep only APP_STORE_ENGAGEMENT ---
  let reportIds: string[] = [];
  try {
    const reportsResp = await axios.get(
      `${BASE}/analyticsReportRequests/${requestId}/reports`,
      { headers },
    );
    const reports: any[] = reportsResp.data?.data ?? [];
    logger.debug(
      `Analytics request ${requestId}: ${reports.length} report(s) – categories: ${reports.map((r) => r.attributes?.category).join(", ")}`,
    );

    // Filter by the correct attribute: `category` (not `reportType`)
    const relevant = reports.filter(
      (r: any) => r.attributes?.category === "APP_STORE_ENGAGEMENT",
    );
    reportIds = relevant.map((r: any) => r.id).filter(Boolean);

    if (reportIds.length === 0) {
      logger.info(
        `No APP_STORE_ENGAGEMENT reports available yet for request ${requestId} (${bundleId}).`,
      );
      return 0;
    }
  } catch (err: any) {
    logger.warn(
      `Listing reports for request ${requestId}: ${err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? err)}`,
    );
    return 0;
  }

  let storedRows = 0;

  for (const reportId of reportIds) {
    // --- 2. List daily instances within the time window ---
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
      // --- 3. Get segment download URLs ---
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
          const dlResp = await axios.get(url, { responseType: "arraybuffer" });
          const raw = zlib
            .gunzipSync(Buffer.from(dlResp.data))
            .toString("utf-8");
          const rows = raw.includes("\t") ? parseTsv(raw) : parseCsv(raw);
          if (rows.length === 0) continue;

          logger.debug(
            `Engagement segment columns: ${Object.keys(rows[0]).join(" | ")}`,
          );

          // --- 4. Aggregate by (Date, Territory) using Event-based parsing ---
          // The Discovery & Engagement report is an event log:
          //   Event = "Impression"  → add Counts to impressions
          //   Event = "Page view"   → add Counts to pageViews
          // There is NO pre-aggregated "Impressions" column in this report.
          const dayCountry: Record<
            string,
            { impressions: number; pageViews: number; sessions: number }
          > = {};

          for (const row of rows) {
            const dateStr = (row["Date"] ?? row["date"] ?? "").slice(0, 10);
            if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

            const territory =
              (row["Territory"] ?? row["territory"] ?? "WW")
                .toUpperCase()
                .trim() || "WW";

            const key = `${dateStr}::${territory}`;
            if (!dayCountry[key])
              dayCountry[key] = { impressions: 0, pageViews: 0, sessions: 0 };

            const eventType = (row["Event"] ?? row["event"] ?? "").trim();
            const counts =
              parseInt(row["Counts"] ?? row["counts"] ?? "0", 10) || 0;

            if (eventType === "Impression") {
              dayCountry[key].impressions += counts;
            } else if (eventType === "Page view") {
              dayCountry[key].pageViews += counts;
            }
            // Sessions live in the APP_USAGE "App Sessions" report, not here.
          }

          const entries = Object.entries(dayCountry);
          await Promise.all(
            entries.map(([key, metrics]) => {
              const [dateStr, country] = key.split("::");
              const reportDate = new Date(dateStr);
              return prisma.appStoreAnalytics.upsert({
                where: {
                  bundleId_reportDate_country: { bundleId, reportDate, country },
                },
                create: { bundleId, reportDate, country, ...metrics },
                update: metrics,
              });
            }),
          );
          storedRows += entries.length;
        } catch (err: any) {
          logger.warn(
            `Downloading/parsing engagement segment: ${err?.message ?? err}`,
          );
        }
      }
    }
  }

  return storedRows;
}

export async function fetchEngagementReport(
  settings: EffectiveSettings,
  ascAppId: string,
  bundleId: string,
  requestId: string | null,
  snapshotRequestId: string | null,
  daysBack = 60,
): Promise<{
  rows: number;
  requestId: string | null;
  snapshotRequestId: string | null;
}> {
  if (!ascAppId) {
    logger.warn("ASC App ID not configured – skipping engagement report fetch");
    return { rows: 0, requestId: null, snapshotRequestId: null };
  }

  const headers = authHeaders(settings);
  const BASE = "https://api.appstoreconnect.apple.com/v1";

  if (!requestId) {
    // Create ONGOING request (generates data daily going forward).
    // On 409 the request already exists in ASC – look it up instead.
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
        `Created ONGOING analytics report request ${requestId} for ${bundleId}.`,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        try {
          const listResp = await axios.get(
            `${BASE}/apps/${ascAppId}/analyticsReportRequests`,
            {
              headers,
              params: { "filter[accessType]": "ONGOING", limit: 10 },
            },
          );
          const existing = (listResp.data?.data ?? []).find(
            (r: any) => r.attributes?.accessType === "ONGOING",
          );
          requestId = existing?.id ?? null;
          if (requestId) {
            logger.info(
              `Recovered existing ONGOING analytics request ${requestId} for ${bundleId}.`,
            );
          } else {
            logger.warn(
              `Could not recover existing ONGOING request for ${bundleId}.`,
            );
          }
        } catch (listErr: any) {
          logger.warn(
            `Listing existing analytics requests failed: ${listErr?.message ?? listErr}`,
          );
        }
      } else {
        logger.warn(
          `Creating ONGOING analytics report request failed: ${err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? err)}`,
        );
      }
    }

    // Also create a ONE_TIME_SNAPSHOT to immediately backfill historical data
    // (available back to Jan 1 2024 per Apple docs; limit: 1 per month)
    let snapshotRows = 0;
    let resolvedSnapshotId: string | null = null;
    try {
      const snapResp = await axios.post(
        `${BASE}/analyticsReportRequests`,
        {
          data: {
            type: "analyticsReportRequests",
            attributes: { accessType: "ONE_TIME_SNAPSHOT" },
            relationships: {
              app: { data: { type: "apps", id: ascAppId } },
            },
          },
        },
        { headers },
      );
      resolvedSnapshotId = snapResp.data?.data?.id ?? null;
      if (resolvedSnapshotId) {
        logger.info(
          `Created ONE_TIME_SNAPSHOT request ${resolvedSnapshotId} for ${bundleId} – processing historical data now.`,
        );
        snapshotRows = await processAnalyticsRequest(
          settings,
          bundleId,
          resolvedSnapshotId,
          daysBack,
        );
        logger.info(
          `ONE_TIME_SNAPSHOT processed: ${snapshotRows} rows stored for ${bundleId}.`,
        );
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        logger.info(
          `ONE_TIME_SNAPSHOT already exists for this month (${bundleId}), recovering it.`,
        );
        try {
          const listResp = await axios.get(
            `${BASE}/apps/${ascAppId}/analyticsReportRequests`,
            {
              headers,
              params: { "filter[accessType]": "ONE_TIME_SNAPSHOT", limit: 10 },
            },
          );
          const existingSnap = (listResp.data?.data ?? []).find(
            (r: any) => r.attributes?.accessType === "ONE_TIME_SNAPSHOT",
          );
          if (existingSnap?.id) {
            resolvedSnapshotId = existingSnap.id as string;
            snapshotRows = await processAnalyticsRequest(
              settings,
              bundleId,
              resolvedSnapshotId,
              daysBack,
            );
            logger.info(
              `Existing ONE_TIME_SNAPSHOT processed: ${snapshotRows} rows for ${bundleId}.`,
            );
          }
        } catch (snapListErr: any) {
          logger.warn(
            `Could not process existing snapshot: ${snapListErr?.message ?? snapListErr}`,
          );
        }
      } else {
        logger.info(
          `ONE_TIME_SNAPSHOT request failed (non-fatal): ${err?.response?.data ? JSON.stringify(err.response.data) : (err?.message ?? err)}`,
        );
      }
    }

    return {
      rows: snapshotRows,
      requestId,
      snapshotRequestId: resolvedSnapshotId,
    };
  }

  // --- Subsequent runs: poll ONGOING + still-pending ONE_TIME_SNAPSHOT ---
  let storedRows = await processAnalyticsRequest(
    settings,
    bundleId,
    requestId,
    daysBack,
  );

  // Continue polling the snapshot request until all historical data is fetched
  if (snapshotRequestId) {
    const snapRows = await processAnalyticsRequest(
      settings,
      bundleId,
      snapshotRequestId,
      daysBack,
    );
    storedRows += snapRows;
    if (snapRows > 0) {
      logger.info(
        `ONE_TIME_SNAPSHOT catch-up: ${snapRows} rows for ${bundleId} (snapshot: ${snapshotRequestId})`,
      );
    }
  }

  logger.info(
    `Engagement report: stored ${storedRows} rows for ${bundleId} (ongoing: ${requestId})`,
  );
  return { rows: storedRows, requestId, snapshotRequestId };
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

    await Promise.all(
      reviews.map((r) => {
        const attrs = r.attributes ?? {};
        return prisma.appReview.upsert({
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
      }),
    );
    total += reviews.length;

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
  _userId?: string,
): Promise<AnalyticsSyncResult> {
  const job = await prisma.scrapeJob.create({
    data: { type: "ASC_ANALYTICS", status: "RUNNING", startedAt: new Date() },
  });

  try {
    const downloadDays = await fetchSalesReports(
      settings,
      bundleId,
      ascAppId,
      365,
    );

    let reviewsFetched = 0;
    if (ascAppId) {
      reviewsFetched = await fetchReviews(settings, ascAppId, bundleId);
    }

    let engagementRows = 0;
    if (ascAppId) {
      try {
        const appRecord = await prisma.app.findUnique({
          where: { bundleId },
          select: {
            analyticsRequestId: true,
            analyticsSnapshotRequestId: true,
          },
        });
        const currentRequestId = appRecord?.analyticsRequestId ?? null;
        const currentSnapshotId = appRecord?.analyticsSnapshotRequestId ?? null;

        const result = await fetchEngagementReport(
          settings,
          ascAppId,
          bundleId,
          currentRequestId,
          currentSnapshotId,
          60,
        );
        engagementRows = result.rows;

        // Persist any new/recovered IDs
        const updates: Record<string, string> = {};
        if (result.requestId && result.requestId !== currentRequestId) {
          updates.analyticsRequestId = result.requestId;
        }
        if (
          result.snapshotRequestId &&
          result.snapshotRequestId !== currentSnapshotId
        ) {
          updates.analyticsSnapshotRequestId = result.snapshotRequestId;
        }
        if (Object.keys(updates).length > 0) {
          await prisma.app.update({ where: { bundleId }, data: updates });
          logger.info(
            `Stored analytics IDs for ${bundleId}: ${JSON.stringify(updates)}`,
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
