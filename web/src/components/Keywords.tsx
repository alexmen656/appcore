import { useState } from "react";
import { useApi, apiPost, apiDelete } from "../hooks/useApi";
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

const TH = "text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 px-3.5 py-2.5 border-b border-[#e5e7eb] whitespace-nowrap";
const TD = "px-3.5 py-3 border-b border-[#f0f0f0] text-[13px] align-middle";
const inputCls = "px-3 py-[7px] rounded-[6px] border border-[#e5e7eb] bg-white text-[#1a1a2e] text-[13px] outline-none focus:border-[#ea0e2b] transition-colors font-[inherit]";
const btnPrimSm = "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecSm  = "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-xs font-medium border border-[#e5e7eb] bg-white text-[#1a1a2e] hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

interface Keyword {
  id: string;
  term: string;
  country: string;
  language: string;
  popularity: number | null;
  difficulty: number | null;
  searchVolume: number | null;
  ourRank: number | null;
  topCompetitor: { name: string; rank: number } | null;
  trackingCount: number;
  suggestionCount: number;
  updatedAt: string;
}
interface RankingEntry {
  rank: number | null;
  appName: string;
  appBundleId: string;
  country: string;
  trackedAt: string;
}
interface HistoryData {
  keyword: {
    id: string;
    term: string;
    popularity: number | null;
    difficulty: number | null;
  };
  rankings: RankingEntry[];
}
interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

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

export default function Keywords({ addToast }: Props) {
  const { data, loading, refetch } = useApi<Keyword[]>("/keywords");
  const [newTerm, setNewTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [sortBy, setSortBy] = useState<"popularity" | "term" | "rank">(
    "popularity",
  );
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading keywords…
      </div>
    );

  const keywords = data || [];
  const sorted = [...keywords].sort((a, b) => {
    if (sortBy === "popularity")
      return (b.popularity ?? -1) - (a.popularity ?? -1);
    if (sortBy === "rank") return (a.ourRank ?? 999) - (b.ourRank ?? 999);
    return a.term.localeCompare(b.term);
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    setAdding(true);
    try {
      await apiPost("/keywords", { term: newTerm.trim() });
      setNewTerm("");
      addToast(`Keyword "${newTerm.trim()}" added`, "success");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, term: string) => {
    try {
      await apiDelete(`/keywords/${id}`);
      addToast(`Keyword "${term}" removed`, "info");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  const loadHistory = async (kw: Keyword) => {
    if (selectedKeyword?.id === kw.id) {
      setSelectedKeyword(null);
      setHistory(null);
      return;
    }
    setSelectedKeyword(kw);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/keywords/${kw.id}/history`);
      setHistory(await res.json());
    } catch {
      addToast("Failed to load history", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

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

  const rankColor = (rank: number | null) => {
    if (rank == null) return "text-gray-400";
    if (rank <= 5) return "text-emerald-600 font-semibold";
    if (rank <= 20) return "text-amber-600 font-semibold";
    return "text-red-500 font-semibold";
  };
  const diffColor = (d: number | null) =>
    d == null
      ? "text-gray-400"
      : d > 60
        ? "text-red-500 font-medium"
        : d > 30
          ? "text-amber-500 font-medium"
          : "text-emerald-600 font-medium";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">
        Keywords
      </h1>
      <p className="text-base text-gray-500 mb-7">
        Track keyword rankings and discover new opportunities
      </p>

      {/* Add keyword form */}
      <form
        onSubmit={handleAdd}
        className="flex items-center gap-2.5 flex-wrap mb-6"
      >
        <input
          className={`${inputCls} w-56`}
          type="text"
          placeholder="Add keyword to track…"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
        />
        <button type="submit" className={btnPrimSm} disabled={adding}>
          + Add
        </button>
        <div className="flex-1" />
        <select
          className={`${inputCls} cursor-pointer`}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="popularity">Sort by Popularity</option>
          <option value="rank">Sort by Rank</option>
          <option value="term">Sort by Term</option>
        </select>
      </form>

      {sorted.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-5xl mb-3 opacity-30">🔍</div>
          <div className="text-sm font-medium text-gray-500 mb-1">
            No keywords tracked yet
          </div>
          <div className="text-xs text-gray-400">
            Add keywords above or run a competitor keyword extraction
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden mb-5">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Keyword</th>
                <th className={TH}>Country</th>
                <th className={TH}>Popularity</th>
                <th className={TH}>Difficulty</th>
                <th className={TH}>Results</th>
                <th className={TH}>Our Rank</th>
                <th className={TH}>Top Competitor</th>
                <th className={TH}>Tracked</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((k) => (
                <tr
                  key={k.id}
                  onClick={() => loadHistory(k)}
                  className={`cursor-pointer hover:bg-gray-50/60 ${selectedKeyword?.id === k.id ? "!bg-blue-50/60" : ""}`}
                >
                  <td className={`${TD} font-medium text-[#1a1a2e]`}>{k.term}</td>
                  <td className={`${TD} text-gray-500`}>{k.country}</td>
                  <td className={TD}>
                    {k.popularity != null ? (
                      <span className="flex items-center gap-1.5">
                        {k.popularity.toFixed(0)}
                        <span className="inline-block h-1 w-8 bg-[#e5e7eb] rounded-sm overflow-hidden align-middle ml-1.5">
                          <span
                            className="block h-full rounded-sm"
                            style={{
                              width: `${Math.min(k.popularity, 100)}%`,
                              background:
                                k.popularity > 60
                                  ? "#10b981"
                                  : k.popularity > 30
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    <span className={diffColor(k.difficulty)}>
                      {k.difficulty != null ? (
                        k.difficulty.toFixed(0)
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </span>
                  </td>
                  <td className={`${TD} text-gray-500`}>
                    {k.searchVolume != null ? (
                      k.searchVolume
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    {k.ourRank != null ? (
                      <span className={rankColor(k.ourRank)}>#{k.ourRank}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">not ranked</span>
                    )}
                  </td>
                  <td className={TD}>
                    {k.topCompetitor ? (
                      <span className="text-xs text-gray-500">
                        #{k.topCompetitor.rank}{" "}
                        <span className="text-gray-400">
                          {k.topCompetitor.name.length > 18
                            ? k.topCompetitor.name.substring(0, 18) + "…"
                            : k.topCompetitor.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-gray-400 text-xs`}>{k.trackingCount}×</td>
                  <td className={TD}>
                    <button
                      className={`${btnSecSm} !text-red-500 !border-red-200 hover:!bg-red-50`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(k.id, k.term);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ranking History Chart */}
      {selectedKeyword && (
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-[#1a1a2e]">
                Ranking History:{" "}
                <span className="text-[#ea0e2b]">{selectedKeyword.term}</span>
              </h3>
              <div className="text-xs text-gray-400 mt-1">
                {selectedKeyword.country.toUpperCase()} · Popularity{" "}
                {selectedKeyword.popularity ?? "—"} · Difficulty{" "}
                {selectedKeyword.difficulty ?? "—"}
              </div>
            </div>
            <button
              className={btnSecSm}
              onClick={() => {
                setSelectedKeyword(null);
                setHistory(null);
              }}
            >
              ✕ Close
            </button>
          </div>

          {historyLoading ? (
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
                />{" "}
x                <Legend
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
      )}

      <div className="text-xs text-gray-400 mt-2">
        {sorted.length} keyword{sorted.length !== 1 ? "s" : ""} tracked
      </div>
    </div>
  );
}
