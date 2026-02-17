import { useState } from "react";
import { useApi, apiPost, apiDelete } from "../hooks/useApi";

interface Keyword {
  id: string;
  term: string;
  country: string;
  language: string;
  popularity: number | null;
  difficulty: number | null;
  searchVolume: number | null;
  latestRank: number | null;
  rankingCount: number;
  suggestionCount: number;
  updatedAt: string;
}

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Keywords({ addToast }: Props) {
  const { data, loading, refetch } = useApi<Keyword[]>("/keywords");
  const [newTerm, setNewTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [sortBy, setSortBy] = useState<"popularity" | "term" | "rank">("popularity");

  if (loading) return <div className="loading"><div className="spinner" /> Loading keywords…</div>;

  const keywords = data || [];

  const sorted = [...keywords].sort((a, b) => {
    if (sortBy === "popularity") return (b.popularity ?? 0) - (a.popularity ?? 0);
    if (sortBy === "rank") return (a.latestRank ?? 999) - (b.latestRank ?? 999);
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

  return (
    <div>
      <h1 className="page-title">Keywords</h1>
      <p className="page-subtitle">Track keyword rankings and discover new opportunities</p>

      {/* Add Keyword */}
      <form onSubmit={handleAdd} className="filter-bar">
        <input
          type="text"
          placeholder="Add keyword to track…"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
          + Add
        </button>
        <div style={{ flex: 1 }} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
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
          <div className="empty-state-sub">Add keywords above or run a competitor keyword extraction</div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Country</th>
              <th>Popularity</th>
              <th>Difficulty</th>
              <th>Volume</th>
              <th>Rank</th>
              <th>Rankings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((k) => (
              <tr key={k.id}>
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
                            background: k.popularity > 60 ? "var(--success)" : k.popularity > 30 ? "var(--warning)" : "var(--danger)",
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{k.difficulty != null ? k.difficulty.toFixed(0) : "—"}</td>
                <td>{k.searchVolume?.toLocaleString() ?? "—"}</td>
                <td>
                  {k.latestRank != null ? (
                    <span style={{
                      fontWeight: 600,
                      color: k.latestRank <= 10 ? "var(--success)" : k.latestRank <= 50 ? "var(--warning)" : "var(--text-secondary)",
                    }}>
                      #{k.latestRank}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td>{k.rankingCount}</td>
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

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
        {sorted.length} keyword{sorted.length !== 1 ? "s" : ""} tracked
      </div>
    </div>
  );
}
