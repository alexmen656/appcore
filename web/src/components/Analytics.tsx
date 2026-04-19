import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowRight } from "lucide-react";
import { useApi, apiPost, getActiveBundleId } from "../hooks/useApi";
import MetricsChart from "./comps/analytics/MetricsChart";
import type { ChartMarker } from "./comps/analytics/MetricsChart";
import type { AnalyticsSummary, DownloadsData, Review } from "../types";
import { TH, TD } from "../styles";
import {
  fmtNumber,
  fmtRevenue,
  fmtDateTime,
  fmtPct,
  countryName,
} from "../utils/formatters";
import {
  type RangeKey,
  RANGE_OPTIONS,
  rangeToParams,
  rangeLabel,
} from "../utils/analyticsRange";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

// ─── Helper components ─────────────────────────────────────────────────────────

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
      className={`bg-white dark:bg-[#1c2028] border rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] ${
        highlight
          ? "border-[#fde8eb] dark:border-[#3a1f23]"
          : "border-[#eef0f3] dark:border-[#2a2f3d]"
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-2">
        {label}
      </div>
      <div
        className={`text-[26px] font-semibold leading-none ${
          dim
            ? "text-[#9ca3af] dark:text-[#5c6478]"
            : "text-[#111827] dark:text-[#e8eaf0]"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] mt-1.5">
          {sub}
        </div>
      )}
      {note && (
        <div className="text-[11px] text-[#c4c9d4] dark:text-[#3a4050] mt-1 leading-tight">
          {note}
        </div>
      )}
    </div>
  );
}

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
      <div className="w-28 text-[12px] text-[#6b7280] dark:text-[#8b93a5] shrink-0">
        {label}
      </div>
      <div className="flex-1 h-2 bg-[#f3f4f6] dark:bg-[#252b38] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="w-24 text-right">
        <span className="text-[13px] font-medium text-[#111827] dark:text-[#e8eaf0] tabular-nums">
          {fmtNumber(value)}
        </span>
        {total > 0 && (
          <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] ml-1.5">
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
    refetch: refetchReviews,
  } = useApi<Review[]>(`/analytics/reviews?bundleId=${bundleId}&limit=200`);

  const { data: markersData } = useApi<{
    activatedAt: string | null;
    versionUpdates: { date: string; version: string }[];
  }>(`/analytics/markers?bundleId=${bundleId}`, [bundleId], true);

  const markers: ChartMarker[] = useMemo(() => {
    const result: ChartMarker[] = [];
    if (markersData?.activatedAt)
      result.push({ date: markersData.activatedAt, type: "activation" });
    for (const v of markersData?.versionUpdates ?? [])
      result.push({ date: v.date, type: "version", label: v.version });
    return result;
  }, [markersData]);

  const chartData = useMemo(() => {
    const byDay = downloads?.byDay ?? [];
    if (!byDay.length) return byDay;
    const markerDates = markers.map((m) => m.date);
    const minDate = byDay[0].date;
    const maxDate = byDay[byDay.length - 1].date;
    const existing = new Set(byDay.map((d) => d.date));
    const toInject = markerDates.filter(
      (d) => !existing.has(d) && d >= minDate && d <= maxDate,
    );
    if (!toInject.length) return byDay;
    const injected = toInject.map((d) => ({
      date: d,
      downloads: 0,
      updates: 0,
      proceeds: 0,
      impressions: 0,
      pageViews: 0,
      sessions: 0,
    }));
    return [...byDay, ...injected].sort((a, b) => a.date.localeCompare(b.date));
  }, [downloads?.byDay, markers]);

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
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
            Analytics
          </h1>
          <p className="text-sm text-[#9ca3af] dark:text-[#5c6478]">
            App Store performance overview
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
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Now
            </>
          )}
        </button>
      </div>

      {!loading && !summary?.totalDownloads && (reviews ?? []).length === 0 && (
        <div className="mb-5 px-4 py-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 text-[13px] text-amber-800 dark:text-amber-400">
          <strong>No analytics data yet.</strong> Make sure your{" "}
          <a href="/app/settings" className="underline font-medium">
            Vendor Number
          </a>{" "}
          is configured in Settings, then click <strong>Sync Now</strong>.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 p-1 bg-[#f3f4f6] dark:bg-[#1c2028] rounded-xl">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                range === opt.key
                  ? "bg-white dark:bg-[#252b38] text-[#111827] dark:text-[#e8eaf0] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#9ca3af] dark:text-[#5c6478] hover:text-[#6b7280] dark:hover:text-[#8b93a5]"
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
              className="h-8 px-2.5 text-[12px] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl text-[#111827] dark:text-[#e8eaf0] bg-white dark:bg-[#1c2028] focus:outline-none focus:border-[#c4c9d4] dark:focus:border-[#ea0e2b]"
            />
            <span className="text-[#9ca3af] dark:text-[#5c6478] text-[12px]">
              –
            </span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl text-[#111827] dark:text-[#e8eaf0] bg-white dark:bg-[#1c2028] focus:outline-none focus:border-[#c4c9d4] dark:focus:border-[#ea0e2b]"
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
        <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] mb-5">
          <div className="text-[16px] font-semibold text-[#111827] dark:text-[#e8eaf0] mb-2">
            Conversion funnel ({rangeLabel(range)})
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
        <div className="flex items-center justify-end mb-2">
          <Link
            to="/analytics/downloads"
            className="flex items-center gap-1 text-[12px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#ea0e2b] transition-colors"
          >
            Day-by-day table <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <MetricsChart data={chartData} markers={markers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
          <div className="px-5 py-4 border-b border-[#f3f4f6] dark:border-[#2a2f3d] flex items-center justify-between">
            <div className="text-[16px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
              Top Countries
            </div>
            <div className="flex items-center gap-3">
              {hasEngagementData && (
                <div className="flex gap-1 p-0.5 bg-[#f3f4f6] dark:bg-[#252b38] rounded-lg">
                  {(["downloads", "impressions", "pageViews"] as const).map(
                    (m) => (
                      <button
                        key={m}
                        onClick={() => setCountryMetric(m)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          countryMetric === m
                            ? "bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                            : "text-[#9ca3af] dark:text-[#5c6478] hover:text-[#6b7280] dark:hover:text-[#8b93a5]"
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
              <Link
                to="/analytics/countries"
                className="flex items-center gap-1 text-[12px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#ea0e2b] transition-colors"
              >
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          {(downloads?.byCountry ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
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
                        className="hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors"
                      >
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            <img
                              src={`/app/country-flags/${r.country.toLowerCase()}.svg`}
                              alt={r.country}
                              className="w-5 h-4 rounded-xs object-cover shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            <span className="font-medium text-[#111827] dark:text-[#e8eaf0]">
                              {countryName(r.country)}
                            </span>
                            <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
                              {r.country.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`${TD} text-right tabular-nums text-[#111827] dark:text-[#e8eaf0]`}
                        >
                          {fmtNumber(val)}
                        </td>
                        <td className={`${TD} text-right pr-5`}>
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-[#f3f4f6] dark:bg-[#252b38] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#ea0e2b] rounded-full"
                                style={{
                                  width: `${total > 0 ? (val / total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] w-9 text-right">
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

        <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[16px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
              Rating Distribution
            </div>
            <Link
              to="/analytics/reviews"
              className="flex items-center gap-1 text-[12px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#ea0e2b] transition-colors"
            >
              All reviews <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {(reviews ?? []).length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
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
                    <span className="text-[13px] text-[#111827] dark:text-[#e8eaf0] w-3 text-right">
                      {star}
                    </span>
                    <span className="text-[13px] text-[#111827] dark:text-[#e8eaf0] font-medium">{star}</span>
                    <div className="flex-1 h-2 bg-[#f3f4f6] dark:bg-[#252b38] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] w-8 text-right tabular-nums">
                      {count}
                    </span>
                    <span className="text-[11px] text-[#c4c9d4] dark:text-[#3a4050] w-10 text-right tabular-nums">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
