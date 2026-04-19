import { useState, useMemo, useEffect } from "react";
import { useApi, getActiveBundleId, authHeaders } from "../hooks/useApi";
import type { DownloadsData, CountryData } from "../types";
import { TH, TD } from "../styles";
import { fmtNumber, countryName } from "../utils/formatters";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  type RangeKey,
  RANGE_OPTIONS,
  rangeToParams,
  rangeLabel,
  prevPeriodParams,
} from "../utils/analyticsRange";

function TrendBadge({
  current,
  prev,
}: {
  current: number;
  prev: number | undefined;
}) {
  if (prev === undefined || prev === null) return null;
  if (prev === 0 && current === 0) return null;
  if (prev === 0)
    return (
      <span className="ml-1 text-[10px] text-emerald-500 font-medium">new</span>
    );
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
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showTrend, setShowTrend] = useState(false);
  const [prevCountryData, setPrevCountryData] = useState<CountryData[] | null>(null);

  const params = useMemo(
    () => rangeToParams(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const prevParams = useMemo(
    () => prevPeriodParams(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const { data: downloads, loading } = useApi<DownloadsData>(
    `/analytics/downloads?bundleId=${bundleId}${params}`,
  );

  const hasEngagementData = (downloads?.byCountry ?? []).some(
    (c) => c.impressions > 0 || c.pageViews > 0,
  );

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
        <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
          Countries
        </h1>
        <p className="text-sm text-[#9ca3af] dark:text-[#5c6478]">
          Full country breakdown — {rangeLabel(range)}
        </p>
      </div>

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
            <span className="text-[#9ca3af] dark:text-[#5c6478] text-[12px]">–</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl text-[#111827] dark:text-[#e8eaf0] bg-white dark:bg-[#1c2028] focus:outline-none focus:border-[#c4c9d4] dark:focus:border-[#ea0e2b]"
            />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
        <div className="px-5 py-4 border-b border-[#f3f4f6] dark:border-[#2a2f3d] flex items-center justify-between">
          <div className="text-[16px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
            All Countries
          </div>
          <button
            onClick={() => setShowTrend((v) => !v)}
            disabled={!prevParams}
            title={
              !prevParams
                ? "Trend not available for this range"
                : "Toggle period-over-period trend"
            }
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              showTrend
                ? "bg-[#ea0e2b] text-white"
                : "bg-[#f3f4f6] dark:bg-[#252b38] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#6b7280] dark:hover:text-[#8b93a5]"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Trend
          </button>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
            Loading…
          </div>
        ) : (downloads?.byCountry ?? []).length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
            No data for this period
          </div>
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
                      className="hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors"
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
                        {fmtNumber(r.downloads)}
                        {showTrend && (
                          <TrendBadge
                            current={r.downloads}
                            prev={prevByCountry[r.country]?.downloads}
                          />
                        )}
                      </td>
                      {hasEngagementData && (
                        <>
                          <td
                            className={`${TD} text-right tabular-nums text-[#9ca3af] dark:text-[#5c6478]`}
                          >
                            {r.impressions > 0 ? fmtNumber(r.impressions) : "—"}
                            {showTrend && r.impressions > 0 && (
                              <TrendBadge
                                current={r.impressions}
                                prev={prevByCountry[r.country]?.impressions}
                              />
                            )}
                          </td>
                          <td
                            className={`${TD} text-right tabular-nums text-[#9ca3af] dark:text-[#5c6478]`}
                          >
                            {r.pageViews > 0 ? fmtNumber(r.pageViews) : "—"}
                            {showTrend && r.pageViews > 0 && (
                              <TrendBadge
                                current={r.pageViews}
                                prev={prevByCountry[r.country]?.pageViews}
                              />
                            )}
                          </td>
                          <td
                            className={`${TD} text-right tabular-nums text-[#9ca3af] dark:text-[#5c6478]`}
                          >
                            {conv}
                          </td>
                        </>
                      )}
                      <td className={`${TD} text-right pr-5`}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-[#f3f4f6] dark:bg-[#252b38] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#ea0e2b] rounded-full"
                              style={{
                                width: `${total > 0 ? (r.downloads / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] w-9 text-right">
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
