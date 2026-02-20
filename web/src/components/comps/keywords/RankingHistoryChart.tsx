import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Keyword } from "./KeywordTable";

const btnSecSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg text-xs font-medium border border-[#e5e7eb] bg-white text-[#1a1a2e] hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const CHART_COLORS = [
  "#ea0e2b",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export interface RankingEntry {
  rank: number | null;
  appName: string;
  appBundleId: string;
  country: string;
  trackedAt: string;
}

export interface HistoryData {
  keyword: {
    id: string;
    term: string;
    popularity: number | null;
    difficulty: number | null;
  };
  rankings: RankingEntry[];
}

interface Props {
  keyword: Keyword;
  history: HistoryData | null;
  loading: boolean;
  onClose: () => void;
}

export default function RankingHistoryChart({
  keyword,
  history,
  loading,
  onClose,
}: Props) {
  const chartData = (() => {
    if (!history?.rankings?.length) return [];
    const byTime = new Map<string, Record<string, number | null>>();
    for (const r of history.rankings) {
      const date = new Date(r.trackedAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      if (!byTime.has(date)) byTime.set(date, {});
      const label =
        r.appBundleId === "eu.control-center.sites.kaloriq"
          ? "Kalbuddy"
          : r.appName.length > 20
            ? r.appName.substring(0, 20) + "…"
            : r.appName;
      byTime.get(date)![label] = r.rank;
    }
    return Array.from(byTime.entries())
      .reverse()
      .map(([date, ranks]) => ({ date, ...ranks }));
  })();

  const appNames = (() => {
    if (!history?.rankings?.length) return [];
    const seen = new Set<string>();
    for (const r of history.rankings) {
      seen.add(
        r.appBundleId === "eu.control-center.sites.kaloriq"
          ? "Kalbuddy"
          : r.appName.length > 20
            ? r.appName.substring(0, 20) + "…"
            : r.appName,
      );
    }
    const arr = Array.from(seen);
    const idx = arr.indexOf("Kalbuddy");
    if (idx > 0) {
      arr.splice(idx, 1);
      arr.unshift("Kalbuddy");
    }
    return arr;
  })();

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-[#1a1a2e]">
            Ranking History:{" "}
            <span className="text-[#ea0e2b]">{keyword.term}</span>
          </h3>
          <div className="text-xs text-gray-400 mt-1">
            {keyword.country.toUpperCase()} · Popularity{" "}
            {keyword.popularity ?? "—"} · Difficulty {keyword.difficulty ?? "—"}
          </div>
        </div>
        <button className={btnSecSm} onClick={onClose}>
          ✕ Close
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400 gap-2">
          <div className="spinner" /> Loading history…
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          No ranking history yet. Run tracking first.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
            />
            <YAxis
              reversed
              domain={[1, "auto"]}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              label={{
                value: "Rank",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#9ca3af" },
              }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,.1)",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: 12 }}
            />
            {appNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={name === "Kalbuddy" ? 3 : 1.5}
                dot={{ r: name === "Kalbuddy" ? 4 : 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
