import { useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DayData } from "../../../types";
import { fmtShortDate, fmtLargeNum, fmtRevenueShort } from "../../../utils/formatters";
export type { DayData };

interface Props {
  data: DayData[];
}

const METRICS = [
  { key: "impressions", label: "Impressions", color: "#6366f1", axis: "left" },
  { key: "pageViews", label: "Page Views", color: "#0ea5e9", axis: "left" },
  { key: "downloads", label: "Downloads", color: "#ea0e2b", axis: "left" },
  { key: "sessions", label: "Sessions", color: "#10b981", axis: "left" },
  { key: "proceeds", label: "Revenue (USD)", color: "#f59e0b", axis: "right" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-white border border-[#eef0f3] rounded-2xl px-4 py-3"
      style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 160 }}
    >
      <div className="text-[11px] text-[#9ca3af] mb-2 font-medium">{fmtShortDate(String(label))}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[12px] mb-1">
          <span className="flex items-center gap-1.5 text-[#6b7280]">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="font-semibold text-[#111827] tabular-nums">
            {p.dataKey === "proceeds"
              ? `$${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MetricsChart({ data }: Props) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(["downloads", "impressions", "pageViews"]),
  );

  const hasEngagement = data.some((d) => d.impressions > 0 || d.pageViews > 0);
  const hasRevenue = data.some((d) => d.proceeds > 0);
  const showRightAxis = activeMetrics.has("proceeds") && hasRevenue;

  function toggleMetric(key: MetricKey) {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-[15px] font-semibold text-[#111827]">Metrics over time</div>
          <div className="text-[12px] text-[#9ca3af] mt-0.5">Daily breakdown</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => {
            const active = activeMetrics.has(m.key);
            // dim engagement metrics if no data yet
            const noData =
              (m.key === "impressions" || m.key === "pageViews" || m.key === "sessions") &&
              !hasEngagement;
            const revenueNoData = m.key === "proceeds" && !hasRevenue;
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                title={
                  noData
                    ? "Requires Analytics Reports API – sync to populate"
                    : revenueNoData
                      ? "No revenue data"
                      : undefined
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors ${
                  active
                    ? "border-transparent text-white"
                    : "bg-white border-[#eef0f3] text-[#9ca3af] hover:border-[#d1d5db] hover:text-[#6b7280]"
                } ${noData || revenueNoData ? "opacity-40 cursor-default" : "cursor-pointer"}`}
                style={active ? { background: m.color, borderColor: m.color } : undefined}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: active ? "rgba(255,255,255,0.8)" : m.color }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasEngagement && (activeMetrics.has("impressions") || activeMetrics.has("pageViews") || activeMetrics.has("sessions")) && (
        <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-[#f8f9fb] border border-[#eef0f3] text-[12px] text-[#6b7280]">
          Impressions, page views and sessions come from Apple's Analytics Reports API.
          On the first <strong>Sync</strong>, Apple creates the data request — run a second sync after a few minutes for the data to appear.
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-52 text-[13px] text-[#9ca3af]">
          No data yet — sync to fetch metrics.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 4, right: showRightAxis ? 48 : 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtShortDate}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={fmtLargeNum}
            />
            {showRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={fmtRevenueShort}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10, color: "#6b7280" }}
              iconType="circle"
              iconSize={7}
            />
            {METRICS.filter((m) => activeMetrics.has(m.key)).map((m) =>
              m.key === "proceeds" ? (
                <Bar
                  key={m.key}
                  yAxisId="right"
                  dataKey={m.key}
                  name={m.label}
                  fill={m.color}
                  opacity={0.7}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={12}
                />
              ) : (
                <Line
                  key={m.key}
                  yAxisId="left"
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
