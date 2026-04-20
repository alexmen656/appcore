import { useState, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  RefreshCw,
  ArrowRight,
  Clock,
  Download,
  Eye,
  Monitor,
  Activity,
  DollarSign,
  TrendingUp,
} from "lucide-react";
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

function Sparkline({
  data,
  color,
  id,
}: {
  data: number[];
  color: string;
  id: string;
}) {
  if (!data || data.length < 2) return null;
  const w = 200;
  const h = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const allZero = max === 0;
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: allZero ? h - 2 : h - ((v - min) / range) * (h - 8) - 4,
  }));
  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `M0,${h} ${pts.map((p) => `L${p.x},${p.y}`).join(" ")} L${w},${h} Z`;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={allZero ? 0 : 0.2} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight: _highlight,
  dim,
  note,
  sparkline,
  icon,
  color = "#6366f1",
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  dim?: boolean;
  note?: string;
  sparkline?: number[];
  icon?: ReactNode;
  color?: string;
}) {
  const hasSparkline = !dim && sparkline && sparkline.length >= 2;
  const gradId = `sg_${label.replace(/\W/g, "")}`;
  return (
    <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[13px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
            {label}
          </span>
          {icon && (
            <span className="text-[#9ca3af] dark:text-[#5c6478]">{icon}</span>
          )}
        </div>
        <div
          className={`text-[40px] font-bold leading-none mb-2 ${
            dim
              ? "text-[#9ca3af] dark:text-[#5c6478]"
              : "text-[#111827] dark:text-[#e8eaf0]"
          }`}
        >
          {value}
        </div>
        {sub && (
          <div className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {sub}
          </div>
        )}
        {note && (
          <div className="text-[11px] text-[#c4c9d4] dark:text-[#3a4050] mt-1 leading-tight">
            {note}
          </div>
        )}
      </div>
      <div className="h-16">
        {hasSparkline && (
          <Sparkline data={sparkline!} color={color} id={gradId} />
        )}
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  pct,
  color,
  dropOff,
  isLast,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  dropOff?: number;
  isLast?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: color }}
          />
          <span className="text-[13px] font-medium text-[#111827] dark:text-[#e8eaf0]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums font-semibold text-[#111827] dark:text-[#e8eaf0]">
            {fmtNumber(value)}
          </span>
          <span className="text-[12px] tabular-nums text-[#9ca3af] dark:text-[#5c6478] w-12 text-right">
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="h-2.5 w-full bg-[#f3f4f6] dark:bg-[#252b38] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {!isLast && dropOff !== undefined && (
        <div className="flex items-center gap-1.5 pl-1 pb-1">
          <div className="w-px h-3 bg-[#e5e7eb] dark:bg-[#2a2f3d] ml-[4px]" />
          <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
            {dropOff.toFixed(1)}% drop-off
          </span>
        </div>
      )}
    </div>
  );
}

export default function Analytics({ addToast }: Props) {
  const bundleId = getActiveBundleId() ?? "";
  const navigate = useNavigate();
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

  const { data: reviews, refetch: refetchReviews } = useApi<Review[]>(
    `/analytics/reviews?bundleId=${bundleId}&limit=200`,
  );

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
    <div className="max-w-[1440px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
            Analytics
          </h1>
          <p className="text-sm text-[#9ca3af] dark:text-[#5c6478]">
            {summary?.lastSyncAt && (
              <span>Last synced {fmtDateTime(summary.lastSyncAt)}</span>
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard
          label="Downloads"
          value={sumLoading ? "—" : fmtNumber(summary?.totalDownloads ?? 0)}
          sub={rangeLabel(range)}
          sparkline={downloads?.byDay.map((d) => d.downloads)}
          icon={<Download className="w-4 h-4" />}
          color="#6366f1"
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
          sparkline={downloads?.byDay.map((d) => d.impressions)}
          icon={<Eye className="w-4 h-4" />}
          color="#0ea5e9"
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
          sparkline={downloads?.byDay.map((d) => d.pageViews)}
          icon={<Monitor className="w-4 h-4" />}
          color="#8b5cf6"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
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
          sparkline={downloads?.byDay.map((d) => d.sessions)}
          icon={<Activity className="w-4 h-4" />}
          color="#10b981"
        />
        <StatCard
          label="Revenue"
          value={sumLoading ? "—" : fmtRevenue(summary?.totalProceeds ?? 0)}
          sub="Developer proceeds"
          sparkline={downloads?.byDay.map((d) => d.proceeds)}
          icon={<DollarSign className="w-4 h-4" />}
          color="#f59e0b"
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
          sparkline={downloads?.byDay.map((d) =>
            d.impressions > 0 ? (d.downloads / d.impressions) * 100 : 0,
          )}
          icon={<TrendingUp className="w-4 h-4" />}
          color="#ea0e2b"
        />
      </div>

      {hasEngagementData &&
        (() => {
          const imp = summary?.totalImpressions ?? 0;
          const pv = summary?.totalPageViews ?? 0;
          const dl = summary?.totalDownloads ?? 0;
          const pvPct = imp > 0 ? (pv / imp) * 100 : 0;
          const dlPct = imp > 0 ? (dl / imp) * 100 : 0;
          const dropImpToPv = 100 - pvPct;
          const dropPvToDl = pvPct > 0 ? pvPct - dlPct : 0;
          return (
            <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] mb-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[16px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
                  Conversion Funnel
                </div>
                <span className="text-[12px] text-[#9ca3af] dark:text-[#5c6478]">
                  {rangeLabel(range)}
                </span>
              </div>
              <div className="flex flex-col gap-0">
                <FunnelStep
                  label="Impressions"
                  value={imp}
                  pct={100}
                  color="#6366f1"
                  dropOff={dropImpToPv}
                />
                <FunnelStep
                  label="Page Views"
                  value={pv}
                  pct={pvPct}
                  color="#0ea5e9"
                  dropOff={dropPvToDl}
                />
                <FunnelStep
                  label="Downloads"
                  value={dl}
                  pct={dlPct}
                  color="#ea0e2b"
                  isLast
                />
              </div>
            </div>
          );
        })()}

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
                        onClick={() =>
                          navigate(
                            `/analytics/countries/${r.country.toLowerCase()}`,
                          )
                        }
                        className="hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors cursor-pointer"
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
                    <span className="text-[13px] text-[#111827] dark:text-[#e8eaf0] font-medium">
                      {star}
                    </span>
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
