import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { Keyword } from "./KeywordTable";
import { borderDefault, btnSecSm, textMuted, textPrimary, textSecondary } from "../../styles";
import { apiPost } from "../../hooks/useApi";
import { usePermissions } from "../../hooks/usePermissions";
import type { RankingEntry, KeywordHistoryData } from "../../types";

export type { KeywordHistoryData as HistoryData };

export interface AppliedEvent {
  type: string;
  locale: string;
  appliedAt: string;
}

const CHART_COLORS = ["#D94412", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const TYPE_LABEL: Record<string, string> = {
  TITLE: "Title",
  SUBTITLE: "Subtitle",
  KEYWORDS: "Keywords",
  DESCRIPTION: "Description",
};

interface Props {
  keyword: Keyword;
  history: KeywordHistoryData | null;
  loading: boolean;
  ownBundleId?: string | null;
  events?: AppliedEvent[];
  addToast?: (msg: string, type: "success" | "error" | "info") => void;
  onClose: () => void;
}

export default function RankingHistoryChart({
  keyword,
  history,
  loading,
  ownBundleId,
  events,
  addToast,
  onClose,
}: Props) {
  const { canWrite } = usePermissions();
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());

  const addCompetitor = async (bundleId: string, name: string) => {
    if (!history?.ownAppId) return;
    setAdding((prev) => new Set(prev).add(bundleId));
    try {
      await apiPost(`/apps/${history.ownAppId}/competitors`, { bundleId });
      setTracked((prev) => new Set(prev).add(bundleId));
      addToast?.(`${name} added to competitors`, "success");
    } catch (e: any) {
      addToast?.(e.message, "error");
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(bundleId);
        return next;
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const ownLabel = "Your App";
  const bucketTime = new Map<string, number>();
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
      if (!bucketTime.has(date)) bucketTime.set(date, new Date(r.trackedAt).getTime());
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

  const markers = (() => {
    if (!events?.length || chartData.length === 0) return [];
    const times = [...bucketTime.entries()].map(([label, ts]) => ({ label, ts }));
    const minTs = Math.min(...times.map((t) => t.ts));
    const maxTs = Math.max(...times.map((t) => t.ts));
    const byLabel = new Map<string, Set<string>>();

    for (const ev of events) {
      const evTs = new Date(ev.appliedAt).getTime();
      if (!Number.isFinite(evTs) || evTs < minTs || evTs > maxTs) continue;
      let nearest = times[0];

      for (const t of times) {
        if (Math.abs(t.ts - evTs) < Math.abs(nearest.ts - evTs)) nearest = t;
      }

      const set = byLabel.get(nearest.label) ?? new Set<string>();
      set.add(TYPE_LABEL[ev.type] ?? ev.type);
      byLabel.set(nearest.label, set);
    }
    return [...byLabel.entries()].map(([label, types]) => ({ label, text: [...types].join(", ") }));
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
                {markers.map((m) => (
                  <ReferenceLine
                    key={m.label}
                    x={m.label}
                    stroke="#D94412"
                    strokeDasharray="4 3"
                    strokeOpacity={0.7}
                    label={{
                      value: `✎ ${m.text}`,
                      position: "top",
                      fontSize: 10,
                      fill: "#D94412",
                    }}
                  />
                ))}
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

          {history?.competitors && history.competitors.length > 0 && (
            <div className="mt-8">
              <div className={`mb-3 text-xs font-medium uppercase tracking-wide ${textMuted}`}>
                All apps ranking for this keyword
              </div>
              <div className={`overflow-hidden rounded-xl border ${borderDefault}`}>
                <table className="w-full text-left">
                  <thead>
                    <tr className={`border-b ${borderDefault} text-[11px] uppercase tracking-wider ${textMuted}`}>
                      <th className="px-4 py-2.5 font-semibold">App</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Rank</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.competitors.map((c) => {
                      const isTracked = c.isTracked || tracked.has(c.bundleId);
                      const isAdding = adding.has(c.bundleId);
                      return (
                        <tr
                          key={c.bundleId}
                          className={`border-b last:border-b-0 ${borderDefault} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {c.iconUrl ? (
                                <img src={c.iconUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-[#f3f4f6] dark:bg-[#252b38] flex items-center justify-center text-[11px] font-bold text-[#6b7280] shrink-0">
                                  {c.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className={`text-[13px] font-medium ${textPrimary} truncate`}>{c.name}</div>
                                <div className={`text-[11px] ${textMuted} truncate`}>{c.bundleId}</div>
                              </div>
                            </div>
                          </td>
                          <td className={`px-4 py-2.5 text-right text-[13px] tabular-nums ${textSecondary}`}>
                            {c.rank != null ? `#${c.rank}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {c.isOwn ? (
                              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#D94412]">
                                You
                              </span>
                            ) : isTracked ? (
                              <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${textMuted}`}>
                                <Check className="w-3.5 h-3.5" /> Tracked
                              </span>
                            ) : (
                              <button
                                onClick={() => addCompetitor(c.bundleId, c.name)}
                                disabled={isAdding || !canWrite || !history.ownAppId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg text-[12px] font-semibold bg-[#F4C7A1] text-[#7a2d0a] hover:bg-[#f0b888] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isAdding ? (
                                  <>
                                    <div className="spinner !w-3 !h-3" /> Adding…
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> Add
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
