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

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    );
    if (found !== undefined) return row[found] ?? "";
  }
  return "";
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
          reDownloads: number;
          proceeds: number;
        }
      > = {};

      for (const row of rows) {
        const typeId = row["Product Type Identifier"] ?? "";
        const units = parseInt(row["Units"] ?? "0", 10) || 0;
        const proceeds = parseFloat(row["Developer Proceeds"] ?? "0") || 0;
        const country = getField(row, "Country Of Sale", "Country of Sale")
          .toUpperCase()
          .trim();
        if (!country) continue;

        if (!byCountry[country]) {
          byCountry[country] = {
            downloads: 0,
            updates: 0,
            reDownloads: 0,
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
      for (const [country, agg] of Object.entries(byCountry)) {
        await prisma.appStoreAnalytics.upsert({
          where: {
            bundleId_reportDate_country: { bundleId, reportDate, country },
          },
          create: { bundleId, reportDate, country, ...agg },
          update: agg,
        });
      }

      storedDays++;
      logger.debug(
        `Sales report stored: ${dateStr} (${Object.keys(byCountry).length} countries)`,
      );
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
): Promise<AnalyticsSyncResult> {
  const job = await prisma.scrapeJob.create({
    data: { type: "ASC_ANALYTICS", status: "RUNNING", startedAt: new Date() },
  });

  try {
    const downloadDays = await fetchSalesReports(settings, bundleId, 60);

    let reviewsFetched = 0;
    if (ascAppId) {
      reviewsFetched = await fetchReviews(settings, ascAppId, bundleId);
    }

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        itemsCount: downloadDays + reviewsFetched,
        result: JSON.stringify({ downloadDays, reviewsFetched }),
      },
    });

    logger.info(
      `ASC analytics sync done: ${downloadDays} report-days, ${reviewsFetched} reviews`,
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
