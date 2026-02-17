import { useState } from "react";
import { useApi, apiPost } from "../hooks/useApi";

interface Suggestion {
  id: string;
  type: string;
  locale: string;
  suggestedValue: string;
  currentValue: string | null;
  reasoning: string;
  confidenceScore: number | null;
  estimatedImpact: number | null;
  status: string;
  aiProvider: string;
  aiModel: string;
  keyword: string | null;
  createdAt: string;
  appliedAt: string | null;
}

interface SuggestionsData {
  suggestions: Record<string, Suggestion[]>;
  total: number;
}

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Suggestions({ addToast }: Props) {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const filterQ = [
    statusFilter && `status=${statusFilter}`,
    typeFilter && `type=${typeFilter}`,
  ]
    .filter(Boolean)
    .join("&");

  const { data, loading, refetch } = useApi<SuggestionsData>(
    `/suggestions${filterQ ? `?${filterQ}` : ""}`,
    [statusFilter, typeFilter]
  );

  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  if (loading) return <div className="loading"><div className="spinner" /> Loading suggestions…</div>;

  const groups = data?.suggestions || {};
  const locales = Object.keys(groups);
  const currentLocale = activeLocale || locales[0] || "en-US";
  const items = groups[currentLocale] || [];

  const handleAction = async (id: string, action: "approve" | "reject" | "apply") => {
    setActing(id);
    try {
      await apiPost(`/suggestions/${id}/${action}`);
      addToast(
        `Suggestion ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "applied"}`,
        "success"
      );
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActing(null);
    }
  };

  const handleBulkApprove = async () => {
    try {
      await apiPost("/suggestions/bulk-approve", { locale: currentLocale });
      addToast(`All pending suggestions for ${currentLocale} approved`, "success");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  return (
    <div>
      <h1 className="page-title">ASO Suggestions</h1>
      <p className="page-subtitle">AI-generated optimization suggestions across locales</p>

      {/* Filters */}
      <div className="filter-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="APPLIED">Applied</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="TITLE">Title</option>
          <option value="SUBTITLE">Subtitle</option>
          <option value="KEYWORDS">Keywords</option>
          <option value="DESCRIPTION">Description</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={handleBulkApprove}>
          Approve All Pending ({currentLocale})
        </button>
      </div>

      {/* Locale Tabs */}
      {locales.length > 0 && (
        <div className="locale-pills">
          {locales.map((loc) => (
            <button
              key={loc}
              className={`locale-pill${currentLocale === loc ? " active" : ""}`}
              onClick={() => setActiveLocale(loc)}
            >
              {loc}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                ({groups[loc]?.length || 0})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestion Cards */}
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No suggestions found</div>
          <div className="empty-state-sub">Run an AI analysis from the Actions page to generate suggestions</div>
        </div>
      ) : (
        items.map((s) => (
          <div key={s.id} className="suggestion-card">
            <div className="suggestion-card-header">
              <div className="suggestion-card-meta">
                <span className={`badge badge-${s.type.toLowerCase()}`}>
                  {s.type}
                </span>
                <span className={`badge badge-${s.status.toLowerCase()}`}>
                  {s.status}
                </span>
                {s.confidenceScore != null && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {Math.round(s.confidenceScore * 100)}% confidence
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{ width: `${s.confidenceScore * 100}%` }}
                      />
                    </div>
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {new Date(s.createdAt).toLocaleDateString()} &middot; {s.aiProvider}/{s.aiModel}
              </span>
            </div>

            <div className="suggestion-card-body">
              {s.currentValue && (
                <div className="suggestion-card-current">
                  <strong style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                    Current
                  </strong>
                  {s.currentValue}
                </div>
              )}
              <div className="suggestion-card-new">
                <strong style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                  Suggested
                </strong>
                {s.suggestedValue}
              </div>
            </div>

            {s.reasoning && (
              <div className="suggestion-card-reasoning">
                💡 {s.reasoning}
              </div>
            )}

            {s.status === "PENDING" && (
              <div className="suggestion-card-actions">
                <button
                  className="btn btn-success btn-sm"
                  disabled={acting === s.id}
                  onClick={() => handleAction(s.id, "approve")}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={acting === s.id}
                  onClick={() => handleAction(s.id, "reject")}
                >
                  ✗ Reject
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={acting === s.id}
                  onClick={() => handleAction(s.id, "apply")}
                >
                  ⚡ Apply to ASC
                </button>
              </div>
            )}

            {s.status === "APPROVED" && (
              <div className="suggestion-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={acting === s.id}
                  onClick={() => handleAction(s.id, "apply")}
                >
                  ⚡ Apply to ASC
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
