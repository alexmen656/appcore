import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi, getActiveBundleId, authHeaders } from "../../hooks/useApi";
import type { DownloadsData, CountryData } from "../../types";
import { TD, TH, borderDefault, pageTitle, textMuted, textPrimary } from "../../styles";
import { fmtNumber, countryName, fmtLargeNum } from "../../utils/formatters";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { type RangeKey, RANGE_OPTIONS, rangeToParams, rangeLabel, prevPeriodParams } from "../../utils/analyticsRange";

function TrendBadge({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === null) return null;
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return <span className="ml-1 text-[10px] text-emerald-500 font-medium">new</span>;
  const pct = ((current - prev) / prev) * 100;
  const isUp = pct >= 0;
  return (
    <span
      className={`inline-flex items-center ml-1 text-[10px] font-medium gap-0.5 ${isUp ? "text-emerald-500" : "text-rose-500"}`}
    >
      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function AnalyticsCountries() {
  const bundleId = getActiveBundleId() ?? "";
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showTrend, setShowTrend] = useState(false);
  const [prevCountryData, setPrevCountryData] = useState<CountryData[] | null>(null);

  const params = useMemo(() => rangeToParams(range, customStart, customEnd), [range, customStart, customEnd]);

  const prevParams = useMemo(() => prevPeriodParams(range, customStart, customEnd), [range, customStart, customEnd]);

  const { data: downloads, loading } = useApi<DownloadsData>(`/analytics/downloads?bundleId=${bundleId}${params}`);

  const hasEngagementData = (downloads?.byCountry ?? []).some((c) => c.impressions > 0 || c.pageViews > 0);

  useEffect(() => {
    if (!showTrend || !prevParams || !bundleId) {
      setPrevCountryData(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/analytics/downloads?bundleId=${bundleId}${prevParams}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((d: DownloadsData) => {
        if (!cancelled) setPrevCountryData(d.byCountry);
      })
      .catch(() => {
        if (!cancelled) setPrevCountryData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showTrend, prevParams, bundleId]);

  const prevByCountry = useMemo(
    () => Object.fromEntries((prevCountryData ?? []).map((c) => [c.country, c])),
    [prevCountryData],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className={`${pageTitle} mb-1`}>Countries</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 p-1 bg-[#f3f4f6] dark:bg-[#1c2028] rounded-xl">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                range === opt.key
                  ? "bg-white dark:bg-[#252b38] ${textPrimary} shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "${textMuted} hover:text-[#6b7280] dark:hover:text-[#8b93a5]"
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
              className={`h-8 px-2.5 text-[12px] border ${borderDefault} rounded-xl ${textPrimary} bg-white dark:bg-[#1c2028] focus:outline-none focus:border-[#c4c9d4] dark:focus:border-[#D94412]`}
            />
            <span className={`${textMuted} text-[12px]`}>–</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className={`h-8 px-2.5 text-[12px] border ${borderDefault} rounded-xl ${textPrimary} bg-white dark:bg-[#1c2028] focus:outline-none focus:border-[#c4c9d4] dark:focus:border-[#D94412]`}
            />
          </div>
        )}
      </div>

      {!loading &&
        (downloads?.byDay ?? []).length > 1 &&
        (() => {
          const byDay = downloads!.byDay;
          return (
            <div
              className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] mb-5`}
            >
              <div className={`text-[14px] font-semibold ${textPrimary} mb-1`}>Downloads over time</div>
              <div className={`text-[12px] ${textMuted} mb-4`}>{rangeLabel(range)}</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="countryDlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D94412" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#D94412" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="#f0f1f3" vertical={false} strokeWidth={1} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickFormatter={(v) => fmtLargeNum(v)}
                    width={36}
                  />
                  <Tooltip
                    cursor={{
                      stroke: "#D94412",
                      strokeWidth: 1.5,
                      strokeDasharray: "3 3",
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = new Date(String(label));
                      const dateStr = d.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      });
                      return (
                        <div
                          className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl px-3.5 py-2.5 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.1)]`}
                        >
                          <div className={`${textMuted} mb-1 text-[11px]`}>{dateStr}</div>
                          <div className={`font-semibold ${textPrimary} tabular-nums`}>
                            {fmtNumber(payload[0].value as number)} downloads
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotoneX"
                    dataKey="downloads"
                    stroke="#D94412"
                    strokeWidth={2.5}
                    fill="url(#countryDlGrad)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      stroke: "#fff",
                      fill: "#D94412",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

      {!loading &&
        (downloads?.byCountry ?? []).length > 0 &&
        (() => {
          const top = (downloads?.byCountry ?? []).slice(0, 15);
          const chartData = top.map((c) => ({
            name: countryName(c.country),
            downloads: c.downloads,
          }));
          return (
            <div
              className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] mb-5`}
            >
              <div className={`text-[14px] font-semibold ${textPrimary} mb-4`}>Top {top.length} Countries</div>
              <ResponsiveContainer width="100%" height={top.length * 32 + 8}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                  barCategoryGap="30%"
                >
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickFormatter={(v) => fmtLargeNum(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.025)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div
                          className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl px-3.5 py-2.5 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.1)]`}
                        >
                          <div className={`font-medium ${textPrimary} mb-0.5`}>{d.name}</div>
                          <div className={`${textMuted} tabular-nums`}>{fmtNumber(d.downloads)} downloads</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="downloads" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "#D94412" : i < 3 ? "#f87171" : "#fca5a5"}
                        fillOpacity={i === 0 ? 1 : i < 3 ? 0.8 : 0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

      <div
        className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
      >
        <div className="px-5 py-4 border-b border-[#f3f4f6] dark:border-[#2a2f3d] flex items-center justify-between">
          <div className={`text-[16px] font-semibold ${textPrimary}`}>All Countries</div>
          <button
            onClick={() => setShowTrend((v) => !v)}
            disabled={!prevParams}
            title={!prevParams ? "Trend not available for this range" : "Toggle period-over-period trend"}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              showTrend
                ? "bg-[#D94412] text-white"
                : "bg-[#f3f4f6] dark:bg-[#252b38] ${textMuted} hover:text-[#6b7280] dark:hover:text-[#8b93a5]"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Trend
          </button>
        </div>
        {loading ? (
          <div className={`px-5 py-8 text-center text-[13px] ${textMuted}`}>Loading…</div>
        ) : (downloads?.byCountry ?? []).length === 0 ? (
          <div className={`px-5 py-8 text-center text-[13px] ${textMuted}`}>No data for this period</div>
        ) : (
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
                const total = (downloads?.byCountry ?? []).reduce((s, r) => s + r.downloads, 0);
                return (downloads?.byCountry ?? []).map((r) => {
                  const conv = r.impressions > 0 ? ((r.downloads / r.impressions) * 100).toFixed(1) + "%" : "—";
                  return (
                    <tr
                      key={r.country}
                      onClick={() => navigate(`/analytics/countries/${r.country.toLowerCase()}`)}
                      className="hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors cursor-pointer"
                    >
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <img
                            src={`/app/country-flags/${r.country.toLowerCase()}.svg`}
                            alt={r.country}
                            className="w-5 h-4 rounded-xs object-cover shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          <span className={`font-medium ${textPrimary}`}>{countryName(r.country)}</span>
                          <span className={`text-[11px] ${textMuted}`}>{r.country.toUpperCase()}</span>
                        </div>
                      </td>
                      <td className={`${TD} text-right tabular-nums ${textPrimary}`}>
                        {fmtNumber(r.downloads)}
                        {showTrend && <TrendBadge current={r.downloads} prev={prevByCountry[r.country]?.downloads} />}
                      </td>
                      {hasEngagementData && (
                        <>
                          <td className={`${TD} text-right tabular-nums ${textMuted}`}>
                            {r.impressions > 0 ? fmtNumber(r.impressions) : "—"}
                            {showTrend && r.impressions > 0 && (
                              <TrendBadge current={r.impressions} prev={prevByCountry[r.country]?.impressions} />
                            )}
                          </td>
                          <td className={`${TD} text-right tabular-nums ${textMuted}`}>
                            {r.pageViews > 0 ? fmtNumber(r.pageViews) : "—"}
                            {showTrend && r.pageViews > 0 && (
                              <TrendBadge current={r.pageViews} prev={prevByCountry[r.country]?.pageViews} />
                            )}
                          </td>
                          <td className={`${TD} text-right tabular-nums ${textMuted}`}>{conv}</td>
                        </>
                      )}
                      <td className={`${TD} text-right pr-5`}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-[#f3f4f6] dark:bg-[#252b38] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#D94412] rounded-full"
                              style={{
                                width: `${total > 0 ? (r.downloads / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className={`text-[12px] ${textMuted} w-9 text-right`}>
                            {total > 0 ? Math.round((r.downloads / total) * 100) : 0}%
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
    </div>
  );
}
