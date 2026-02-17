import { useState, useEffect } from "react";
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

export default function Keywords({ addToast }: Props) {
  const { data, loading, refetch } = useApi<Keyword[]>("/keywords");
  const [newTerm, setNewTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [sortBy, setSortBy] = useState<"popularity" | "term" | "rank">(
    "popularity",
  );

  // ─── Ranking history chart state ──────────────────────────────────
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (loading)
    return (
      <div className="loading">
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
      // toggle off
      setSelectedKeyword(null);
      setHistory(null);
      return;
    }
    setSelectedKeyword(kw);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/keywords/${kw.id}/history`);
      const data: HistoryData = await res.json();
      setHistory(data);
    } catch {
      addToast("Failed to load history", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Build chart data from history
  const chartData = (() => {
    if (!history?.rankings?.length) return [];

    // Group rankings by timestamp, each app gets its own series
    const byTime = new Map<string, Record<string, number | null>>();
    const apps = new Set<string>();

    for (const r of history.rankings) {
      const date = new Date(r.trackedAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      if (!byTime.has(date)) byTime.set(date, {});
      const entry = byTime.get(date)!;

      const label =
        r.appBundleId === "eu.control-center.sites.kaloriq"
          ? "Kalbuddy"
          : r.appName.length > 20
            ? r.appName.substring(0, 20) + "…"
            : r.appName;
      apps.add(label);
      entry[label] = r.rank;
    }

    // Sort chronologically (oldest first)
    return Array.from(byTime.entries())
      .reverse()
      .map(([date, ranks]) => ({ date, ...ranks }));
  })();

  const appNames = (() => {
    if (!history?.rankings?.length) return [];
    const seen = new Set<string>();
    for (const r of history.rankings) {
      const label =
        r.appBundleId === "eu.control-center.sites.kaloriq"
          ? "Kalbuddy"
          : r.appName.length > 20
            ? r.appName.substring(0, 20) + "…"
            : r.appName;
      seen.add(label);
    }
    // Put "Kalbuddy" first
    const arr = Array.from(seen);
    const idx = arr.indexOf("Kalbuddy");
    if (idx > 0) {
      arr.splice(idx, 1);
      arr.unshift("Kalbuddy");
    }
    return arr;
  })();

  const CHART_COLORS = [
    "#ea0e2b", // our app = accent red
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ];

  return (
    <div>
      <h1 className="page-title">Keywords</h1>
      <p className="page-subtitle">
        Track keyword rankings and discover new opportunities
      </p>

      {/* Add Keyword */}
      <form onSubmit={handleAdd} className="filter-bar">
        <input
          type="text"
          placeholder="Add keyword to track…"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={adding}
        >
          + Add
        </button>
        <div style={{ flex: 1 }} />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="popularity">Sort by Popularity</option>
          <option value="rank">Sort by Rank</option>
          <option value="term">Sort by Term</option>
        </select>
      </form>

      {/* Keywords Table */}
      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">No keywords tracked yet</div>
          <div className="empty-state-sub">
            Add keywords above or run a competitor keyword extraction
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Country</th>
              <th>Popularity</th>
              <th>Difficulty</th>
              <th>Results</th>
              <th>Our Rank</th>
              <th>Top Competitor</th>
              <th>Tracked</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((k) => (
              <tr
                key={k.id}
                onClick={() => loadHistory(k)}
                style={{
                  cursor: "pointer",
                  background:
                    selectedKeyword?.id === k.id
                      ? "var(--bg-secondary)"
                      : undefined,
                }}
              >
                <td style={{ fontWeight: 500 }}>{k.term}</td>
                <td>{k.country}</td>
                <td>
                  {k.popularity != null ? (
                    <>
                      {k.popularity.toFixed(0)}
                      <div className="confidence-bar" style={{ width: 40 }}>
                        <div
                          className="confidence-fill"
                          style={{
                            width: `${Math.min(k.popularity, 100)}%`,
                            background:
                              k.popularity > 60
                                ? "var(--success)"
                                : k.popularity > 30
                                  ? "var(--warning)"
                                  : "var(--danger)",
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td>
                  {k.difficulty != null ? (
                    <span
                      style={{
                        color:
                          k.difficulty > 60
                            ? "var(--danger)"
                            : k.difficulty > 30
                              ? "var(--warning)"
                              : "var(--success)",
                        fontWeight: 500,
                      }}
                    >
                      {k.difficulty.toFixed(0)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td>
                  {k.searchVolume != null ? (
                    k.searchVolume
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td>
                  {k.ourRank != null ? (
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          k.ourRank <= 5
                            ? "var(--success)"
                            : k.ourRank <= 20
                              ? "var(--warning)"
                              : "var(--danger)",
                      }}
                    >
                      #{k.ourRank}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>
                      not ranked
                    </span>
                  )}
                </td>
                <td>
                  {k.topCompetitor ? (
                    <span
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      #{k.topCompetitor.rank}{" "}
                      <span style={{ color: "var(--text-muted)" }}>
                        {k.topCompetitor.name.length > 18
                          ? k.topCompetitor.name.substring(0, 18) + "…"
                          : k.topCompetitor.name}
                      </span>
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {k.trackingCount}×
                </td>
                <td>
                  <button
                    className="btn btn-sm"
                    style={{ color: "var(--danger)", fontSize: 11 }}
                    onClick={() => handleDelete(k.id, k.term)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── Ranking History Chart ──────────────────────────────────── */}
      {selectedKeyword && (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            background: "#fff",
            borderRadius: 10,
            border: "1px solid var(--border)",
            boxShadow: "0 1px 3px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                Ranking History:{" "}
                <span style={{ color: "var(--primary)" }}>
                  {selectedKeyword.term}
                </span>
              </h3>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                {selectedKeyword.country.toUpperCase()} · Popularity{" "}
                {selectedKeyword.popularity ?? "—"} · Difficulty{" "}
                {selectedKeyword.difficulty ?? "—"}
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedKeyword(null);
                setHistory(null);
              }}
              style={{ fontSize: 11 }}
            >
              ✕ Close
            </button>
          </div>

          {historyLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "var(--text-muted)",
              }}
            >
              <div className="spinner" /> Loading history…
            </div>
          ) : chartData.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "var(--text-muted)",
              }}
            >
              No ranking history yet. Run tracking first.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  tickLine={false}
                />
                <YAxis
                  reversed
                  domain={[1, "auto"]}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  tickLine={false}
                  label={{
                    value: "Rank",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "var(--text-muted)" },
                  }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,.1)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  formatter={(value: number | null) =>
                    value != null ? [`#${value}`, "Rank"] : ["not ranked", ""]
                  }
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
      )}

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
        {sorted.length} keyword{sorted.length !== 1 ? "s" : ""} tracked
      </div>
    </div>
  );
}
