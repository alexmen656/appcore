import { useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Keyword } from "./KeywordTable";
import { btnSecSm, textMuted, textPrimary } from "../../styles";
import type { RankingEntry, KeywordHistoryData } from "../../types";

export type { KeywordHistoryData as HistoryData };

const CHART_COLORS = ["#D94412", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface Props {
  keyword: Keyword;
  history: KeywordHistoryData | null;
  loading: boolean;
  ownBundleId?: string | null;
  onClose: () => void;
}

export default function RankingHistoryChart({ keyword, history, loading, ownBundleId, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const ownLabel = "Your App";
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
        ownBundleId && r.appBundleId === ownBundleId
          ? ownLabel
          : r.appName.length > 20
            ? r.appName.substring(0, 20) + "\u2026"
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
        ownBundleId && r.appBundleId === ownBundleId
          ? ownLabel
          : r.appName.length > 20
            ? r.appName.substring(0, 20) + "\u2026"
            : r.appName,
      );
    }
    const arr = Array.from(seen);
    const idx = arr.indexOf(ownLabel);
    if (idx > 0) {
      arr.splice(idx, 1);
      arr.unshift(ownLabel);
    }
    return arr;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-[#eef0f3] bg-white shadow-2xl dark:border-[#2a2f3d] dark:bg-[#1c2028]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eef0f3] px-6 py-5 dark:border-[#2a2f3d]">
          <div>
            <h3 className={`text-base font-semibold ${textPrimary}`}>
              Ranking History: <span className="text-[#D94412]">{keyword.term}</span>
            </h3>
            <div className={`mt-1 text-xs ${textMuted}`}>
              {keyword.country.toUpperCase()} · Popularity {keyword.popularity ?? "—"} · Difficulty{" "}
              {keyword.difficulty ?? "—"}
            </div>
          </div>
          <button className={btnSecSm} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-6">
          {loading ? (
            <div className={`flex justify-center gap-2 py-16 ${textMuted}`}>
              <div className="spinner" /> Loading history…
            </div>
          ) : chartData.length === 0 ? (
            <div className={`py-16 text-center text-sm ${textMuted}`}>No ranking history yet. Run tracking first.</div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
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
                    border: "1px solid #eef0f3",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,.06)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {appNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={name === ownLabel ? 3 : 1.5}
                    dot={{ r: name === ownLabel ? 4 : 2 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
