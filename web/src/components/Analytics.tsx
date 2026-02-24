import { useState, useMemo } from "react";
import { useApi, apiPost, getActiveBundleId } from "../hooks/useApi";
import MetricsChart from "./comps/analytics/MetricsChart";
import ReviewsList from "./comps/analytics/ReviewsList";
import type { AnalyticsSummary, DownloadsData, Review } from "../types";
import { TH, TD } from "../styles";
import {
  fmtNumber,
  fmtRevenue,
  fmtDateTime,
  fmtPct,
  countryName,
} from "../utils/formatters";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

type RangeKey =
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "180d"
  | "365d"
  | "ytd"
  | "all"
  | "custom";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "14d", label: "14d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "180d", label: "180d" },
  { key: "365d", label: "1y" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

function rangeToParams(
  range: RangeKey,
  customStart?: string,
  customEnd?: string,
): string {
  if (range === "all") return "&period=all";
  if (range === "ytd") return "&period=ytd";
  if (range === "custom") {
    const parts: string[] = [];
    if (customStart) parts.push(`startDate=${customStart}`);
    if (customEnd) parts.push(`endDate=${customEnd}`);
    return parts.length ? "&" + parts.join("&") : "&days=30";
  }
  const days = parseInt(range, 10);
  return `&days=${days}`;
}

function rangeLabel(range: RangeKey): string {
  const map: Record<RangeKey, string> = {
    "7d": "last 7 days",
    "14d": "last 14 days",
    "30d": "last 30 days",
    "90d": "last 90 days",
    "180d": "last 180 days",
    "365d": "last 12 months",
    ytd: "year to date",
    all: "all time",
    custom: "custom range",
  };
  return map[range];
}

// ─── Helper components ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
  dim,
  note,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  dim?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
        highlight ? "border-[#fde8eb]" : "border-[#eef0f3]"
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] mb-2">
        {label}
      </div>
      <div
        className={`text-[26px] font-semibold leading-none ${
          dim ? "text-[#9ca3af]" : "text-[#111827]"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[12px] text-[#9ca3af] mt-1.5">{sub}</div>}
      {note && (
        <div className="text-[11px] text-[#c4c9d4] mt-1 leading-tight">
          {note}
        </div>
      )}
    </div>
  );
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────

function FunnelRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-[12px] text-[#6b7280] shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="w-24 text-right">
        <span className="text-[13px] font-medium text-[#111827] tabular-nums">
          {fmtNumber(value)}
        </span>
        {total > 0 && (
          <span className="text-[11px] text-[#9ca3af] ml-1.5">
            {pct.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function Analytics({ addToast }: Props) {
  const bundleId = getActiveBundleId() ?? "";
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [countryMetric, setCountryMetric] = useState<
    "downloads" | "impressions" | "pageViews"
  >("downloads");

  const params = useMemo(
    () => rangeToParams(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const {
    data: summary,
    loading: sumLoading,
    refetch: refetchSummary,
  } = useApi<AnalyticsSummary>(
    `/analytics/summary?bundleId=${bundleId}${params}`,
  );

  const {
    data: downloads,
    loading: dlLoading,
    refetch: refetchDownloads,
  } = useApi<DownloadsData>(
    `/analytics/downloads?bundleId=${bundleId}${params}`,
  );

  const {
    data: reviews,
    loading: rvLoading,
    refetch: refetchReviews,
  } = useApi<Review[]>(`/analytics/reviews?bundleId=${bundleId}&limit=200`);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiPost("/analytics/sync", { bundleId });
      addToast("Analytics sync started — data will appear shortly", "info");
      setTimeout(() => {
        refetchSummary();
        refetchDownloads();
        refetchReviews();
      }, 3000);
    } catch (err: any) {
      addToast(err.message ?? "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  const hasEngagementData =
    (summary?.totalImpressions ?? 0) > 0 || (summary?.totalPageViews ?? 0) > 0;

  const loading = sumLoading || dlLoading;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] mb-1">
            Analytics
          </h1>
          <p className="text-sm text-[#9ca3af]">
            App Store performance metrics
            {summary?.lastSyncAt && (
              <span className="ml-2">
                · Last synced {fmtDateTime(summary.lastSyncAt)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] disabled:opacity-60 transition-colors shrink-0"
        >
          {syncing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Syncing…
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Sync Now
            </>
          )}
        </button>
      </div>

      {/* ── No data banner ─────────────────────────────────────────────────── */}
      {!loading && !summary?.totalDownloads && (reviews ?? []).length === 0 && (
        <div className="mb-5 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-100 text-[13px] text-amber-800">
          <strong>No analytics data yet.</strong> Make sure your{" "}
          <a href="/settings" className="underline font-medium">
            Vendor Number
          </a>{" "}
          is configured in Settings, then click <strong>Sync Now</strong>.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 p-1 bg-[#f3f4f6] rounded-xl">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                range === opt.key
                  ? "bg-white text-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#9ca3af] hover:text-[#6b7280]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[#eef0f3] rounded-xl text-[#111827] bg-white focus:outline-none focus:border-[#c4c9d4]"
            />
            <span className="text-[#9ca3af] text-[12px]">–</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[#eef0f3] rounded-xl text-[#111827] bg-white focus:outline-none focus:border-[#c4c9d4]"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Downloads"
          value={sumLoading ? "—" : fmtNumber(summary?.totalDownloads ?? 0)}
          sub={rangeLabel(range)}
          highlight
        />
        <StatCard
          label="Impressions"
          value={
            sumLoading
              ? "—"
              : hasEngagementData
                ? fmtNumber(summary?.totalImpressions ?? 0)
                : "—"
          }
          sub={rangeLabel(range)}
          dim={!hasEngagementData}
          note={
            !hasEngagementData
              ? "Run a 2nd sync once Apple processes the request"
              : undefined
          }
        />
        <StatCard
          label="Product Page Views"
          value={
            sumLoading
              ? "—"
              : hasEngagementData
                ? fmtNumber(summary?.totalPageViews ?? 0)
                : "—"
          }
          sub={rangeLabel(range)}
          dim={!hasEngagementData}
          note={
            !hasEngagementData
              ? "Run a 2nd sync once Apple processes the request"
              : undefined
          }
        />
        <StatCard
          label="Sessions"
          value={
            sumLoading
              ? "—"
              : hasEngagementData
                ? fmtNumber(summary?.totalSessions ?? 0)
                : "—"
          }
          sub={rangeLabel(range)}
          dim={!hasEngagementData}
          note={
            !hasEngagementData
              ? "Run a 2nd sync once Apple processes the request"
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="Revenue"
          value={sumLoading ? "—" : fmtRevenue(summary?.totalProceeds ?? 0)}
          sub="Developer proceeds"
        />
        <StatCard
          label="Conversion Rate"
          value={
            sumLoading
              ? "—"
              : summary?.conversionRate != null
                ? fmtPct(summary.conversionRate)
                : "—"
          }
          sub="Downloads / Impressions"
          dim={!hasEngagementData}
          note={!hasEngagementData ? "Requires impressions data" : undefined}
        />
        <StatCard
          label="Avg Rating"
          value={
            sumLoading || summary?.avgRating == null
              ? "—"
              : summary.avgRating.toFixed(1)
          }
          sub="All-time average"
        />
        <StatCard
          label="Reviews"
          value={sumLoading ? "—" : fmtNumber(summary?.reviewCount ?? 0)}
          sub="Synced reviews"
        />
      </div>

      {hasEngagementData && (
        <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] mb-5">
          <div className="text-[15px] font-semibold text-[#111827] mb-0.5">
            Conversion funnel
          </div>
          <div className="text-[12px] text-[#9ca3af] mb-5">
            From impressions to downloads for {rangeLabel(range)}
          </div>
          <div className="space-y-3">
            <FunnelRow
              label="Impressions"
              value={summary?.totalImpressions ?? 0}
              total={summary?.totalImpressions ?? 0}
              color="#6366f1"
            />
            <FunnelRow
              label="Page Views"
              value={summary?.totalPageViews ?? 0}
              total={summary?.totalImpressions ?? 0}
              color="#0ea5e9"
            />
            <FunnelRow
              label="Downloads"
              value={summary?.totalDownloads ?? 0}
              total={summary?.totalImpressions ?? 0}
              color="#ea0e2b"
            />
          </div>
        </div>
      )}

      <div className="mb-5">
        <MetricsChart data={downloads?.byDay ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white border border-[#eef0f3] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold text-[#111827]">
                Top Countries
              </div>
              <div className="text-[12px] text-[#9ca3af] mt-0.5">
                {rangeLabel(range)}
              </div>
            </div>
            {hasEngagementData && (
              <div className="flex gap-1 p-0.5 bg-[#f3f4f6] rounded-lg">
                {(["downloads", "impressions", "pageViews"] as const).map(
                  (m) => (
                    <button
                      key={m}
                      onClick={() => setCountryMetric(m)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        countryMetric === m
                          ? "bg-white text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "text-[#9ca3af] hover:text-[#6b7280]"
                      }`}
                    >
                      {m === "downloads"
                        ? "DL"
                        : m === "impressions"
                          ? "Imp."
                          : "Views"}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
          {(downloads?.byCountry ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af]">
              No data yet
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Country</th>
                  <th className={`${TH} text-right`}>
                    {countryMetric === "downloads"
                      ? "Downloads"
                      : countryMetric === "impressions"
                        ? "Impressions"
                        : "Page Views"}
                  </th>
                  <th className={`${TH} text-right pr-5`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...(downloads?.byCountry ?? [])].sort(
                    (a, b) => (b[countryMetric] ?? 0) - (a[countryMetric] ?? 0),
                  );
                  const total = sorted.reduce(
                    (s, r) => s + (r[countryMetric] ?? 0),
                    0,
                  );
                  return sorted.slice(0, 10).map((r) => {
                    const val = r[countryMetric] ?? 0;
                    return (
                      <tr
                        key={r.country}
                        className="hover:bg-[#f7f8fa] transition-colors"
                      >
                        <td className={TD}>
                          <span className="font-medium text-[#111827]">
                            {countryName(r.country)}
                          </span>
                          <span className="ml-1.5 text-[11px] text-[#9ca3af]">
                            {r.country.toUpperCase()}
                          </span>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {fmtNumber(val)}
                        </td>
                        <td className={`${TD} text-right pr-5`}>
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#ea0e2b] rounded-full"
                                style={{
                                  width: `${total > 0 ? (val / total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-[12px] text-[#9ca3af] w-9 text-right">
                              {total > 0 ? Math.round((val / total) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="text-[15px] font-semibold text-[#111827] mb-1">
            Rating Distribution
          </div>
          <div className="text-[12px] text-[#9ca3af] mb-4">
            Based on synced reviews
          </div>
          {(reviews ?? []).length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#9ca3af]">
              No reviews yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = (reviews ?? []).filter(
                  (r) => r.rating === star,
                ).length;
                const pct =
                  (reviews ?? []).length > 0
                    ? (count / (reviews ?? []).length) * 100
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-[13px] text-[#111827] w-3 text-right">
                      {star}
                    </span>
                    <span className="text-amber-400 text-[13px]">&#9733;</span>
                    <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-[#9ca3af] w-8 text-right tabular-nums">
                      {count}
                    </span>
                    <span className="text-[11px] text-[#c4c9d4] w-10 text-right tabular-nums">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ReviewsList reviews={reviews ?? []} />

      {(downloads?.byCountry ?? []).length > 0 && (
        <div className="bg-white border border-[#eef0f3] rounded-2xl overflow-hidden mt-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="px-5 py-4 border-b border-[#f3f4f6]">
            <div className="text-[15px] font-semibold text-[#111827]">
              Full Country Breakdown
            </div>
            <div className="text-[12px] text-[#9ca3af] mt-0.5">
              {rangeLabel(range)}
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Country</th>
                <th className={`${TH} text-right`}>Downloads</th>
                {hasEngagementData && (
                  <>
                    <th className={`${TH} text-right`}>Impressions</th>
                    <th className={`${TH} text-right`}>Page Views</th>
                    <th className={`${TH} text-right`}>Conv. Rate</th>
                  </>
                )}
                <th className={`${TH} text-right pr-5`}>Share</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = (downloads?.byCountry ?? []).reduce(
                  (s, r) => s + r.downloads,
                  0,
                );
                return (downloads?.byCountry ?? []).map((r) => {
                  const conv =
                    r.impressions > 0
                      ? ((r.downloads / r.impressions) * 100).toFixed(1) + "%"
                      : "—";
                  return (
                    <tr
                      key={r.country}
                      className="hover:bg-[#f7f8fa] transition-colors"
                    >
                      <td className={TD}>
                        <span className="font-medium text-[#111827]">
                          {countryName(r.country)}
                        </span>
                        <span className="ml-1.5 text-[11px] text-[#9ca3af]">
                          {r.country.toUpperCase()}
                        </span>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {fmtNumber(r.downloads)}
                      </td>
                      {hasEngagementData && (
                        <>
                          <td
                            className={`${TD} text-right tabular-nums text-[#9ca3af]`}
                          >
                            {r.impressions > 0 ? fmtNumber(r.impressions) : "—"}
                          </td>
                          <td
                            className={`${TD} text-right tabular-nums text-[#9ca3af]`}
                          >
                            {r.pageViews > 0 ? fmtNumber(r.pageViews) : "—"}
                          </td>
                          <td
                            className={`${TD} text-right tabular-nums text-[#9ca3af]`}
                          >
                            {conv}
                          </td>
                        </>
                      )}
                      <td className={`${TD} text-right pr-5`}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#ea0e2b] rounded-full"
                              style={{
                                width: `${total > 0 ? (r.downloads / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[12px] text-[#9ca3af] w-9 text-right">
                            {total > 0
                              ? Math.round((r.downloads / total) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
