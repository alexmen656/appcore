import { useState } from "react";
import { borderDefault, textMuted, textPrimary, textSecondary } from "../../styles";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { DayData } from "../../types";
import { fmtShortDate, fmtLargeNum, fmtRevenueShort } from "../../utils/formatters";
export type { DayData };

export interface ChartMarker {
  date: string;
  type: "version" | "activation";
  label?: string;
}

interface Props {
  data: DayData[];
  markers?: ChartMarker[];
}

const METRICS = [
  { key: "impressions", label: "Impressions", color: "#6366f1", axis: "left" },
  { key: "pageViews", label: "Page Views", color: "#0ea5e9", axis: "left" },
  { key: "downloads", label: "Downloads", color: "#D94412", axis: "left" },
  { key: "updates", label: "Updates", color: "#f97316", axis: "left" },
  { key: "sessions", label: "Sessions", color: "#10b981", axis: "left" },
  { key: "proceeds", label: "Revenue (USD)", color: "#f59e0b", axis: "right" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl px-4 py-3`}
      style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 160 }}
    >
      <div className={`text-[11px] ${textMuted} mb-2 font-medium`}>{fmtShortDate(String(label))}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[12px] mb-1">
          <span className={`flex items-center gap-1.5 ${textSecondary}`}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className={`font-semibold ${textPrimary} tabular-nums`}>
            {p.dataKey === "proceeds"
              ? `$${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MetricsChart({ data, markers = [] }: Props) {
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
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className={`text-[16px] font-semibold ${textPrimary}`}>Metrics over time</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => {
            const active = activeMetrics.has(m.key);
            const noData = (m.key === "impressions" || m.key === "pageViews" || m.key === "sessions") && !hasEngagement;
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
                    : "bg-white dark:bg-[#252b38] ${borderDefault} ${textMuted} hover:border-[#d1d5db] dark:hover:border-[#5c6478] hover:text-[#6b7280] dark:hover:text-[#8b93a5]"
                } ${noData || revenueNoData ? "opacity-40 cursor-default" : "cursor-pointer"}`}
                style={active ? { background: m.color, borderColor: m.color } : undefined}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: active ? "rgba(255,255,255,0.8)" : m.color,
                  }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasEngagement &&
        (activeMetrics.has("impressions") || activeMetrics.has("pageViews") || activeMetrics.has("sessions")) && (
          <div
            className={`mb-3 px-3.5 py-2.5 rounded-xl bg-[#f8f9fb] dark:bg-[#252b38] border ${borderDefault} text-[12px] ${textSecondary}`}
          >
            Impressions, page views and sessions come from Apple's Analytics Reports API. On the first{" "}
            <strong>Sync</strong>, Apple creates the data request — run a second sync after a few minutes for the data
            to appear.
          </div>
        )}

      {data.length === 0 ? (
        <div className={`flex items-center justify-center h-52 text-[13px] ${textMuted}`}>
          No data yet — sync to fetch metrics.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={data}
            margin={{
              top: 4,
              right: showRightAxis ? 48 : 16,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="0" stroke="#f0f1f3" vertical={false} strokeWidth={1} />
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
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, color: "#6b7280" }} iconType="circle" iconSize={7} />
            {markers
              .filter((m) => m.type === "activation")
              .map((m) => (
                <ReferenceLine
                  key={`activation-${m.date}`}
                  x={m.date}
                  yAxisId="left"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{
                    value: "Marteso Activation",
                    position: "insideTopLeft",
                    fontSize: 10,
                    fill: "#10b981",
                    dy: 4,
                  }}
                />
              ))}
            {markers
              .filter((m) => m.type === "version")
              .map((m) => (
                <ReferenceLine
                  key={`version-${m.date}-${m.label}`}
                  x={m.date}
                  yAxisId="left"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  label={{
                    value: m.label ?? "v",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#6366f1",
                    dy: 4,
                  }}
                />
              ))}
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
                  type="monotoneX"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: "#fff",
                    fill: m.color,
                  }}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
