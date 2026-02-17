import { useState } from "react";
import { useApi, apiPost } from "../hooks/useApi";

interface Suggestion {
  id: string; type: string; locale: string; suggestedValue: string;
  currentValue: string | null; reasoning: string; confidenceScore: number | null;
  estimatedImpact: number | null; status: string; aiProvider: string; aiModel: string;
  keyword: string | null; createdAt: string; appliedAt: string | null;
}
interface SuggestionsData { suggestions: Record<string, Suggestion[]>; total: number; }
interface Props { addToast: (msg: string, type: "success" | "error" | "info") => void; }

export default function Suggestions({ addToast }: Props) {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const filterQ = [statusFilter && `status=${statusFilter}`, typeFilter && `type=${typeFilter}`].filter(Boolean).join("&");
  const { data, loading, refetch } = useApi<SuggestionsData>(`/suggestions${filterQ ? `?${filterQ}` : ""}`, [statusFilter, typeFilter]);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
      <div className="spinner" /> Loading suggestions…
    </div>
  );

  const groups = data?.suggestions || {};
  const locales = Object.keys(groups);
  const currentLocale = activeLocale || locales[0] || "en-US";
  const items = groups[currentLocale] || [];

  const handleAction = async (id: string, action: "approve" | "reject" | "apply") => {
    setActing(id);
    try {
      await apiPost(`/suggestions/${id}/${action}`);
      addToast(`Suggestion ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "applied"}`, "success");
      refetch();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActing(null); }
  };

  const handleBulkApprove = async () => {
    try {
      await apiPost("/suggestions/bulk-approve", { locale: currentLocale });
      addToast(`All pending suggestions for ${currentLocale} approved`, "success");
      refetch();
    } catch (e: any) { addToast(e.message, "error"); }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">ASO Suggestions</h1>
      <p className="text-base text-gray-500 mb-7">AI-generated optimization suggestions across locales</p>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="APPLIED">Applied</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="TITLE">Title</option>
          <option value="SUBTITLE">Subtitle</option>
          <option value="KEYWORDS">Keywords</option>
          <option value="DESCRIPTION">Description</option>
        </select>
        <div className="flex-1" />
        <button className="btn-secondary btn-sm" onClick={handleBulkApprove}>
          Approve All Pending ({currentLocale})
        </button>
      </div>

      {/* Locale pills */}
      {locales.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {locales.map((loc) => (
            <button key={loc} className={`locale-pill${currentLocale === loc ? " active" : ""}`}
              onClick={() => setActiveLocale(loc)}>
              {loc} <span className="opacity-70">({groups[loc]?.length || 0})</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestion cards */}
      {items.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-5xl mb-3 opacity-30">📋</div>
          <div className="text-sm font-medium text-gray-500 mb-1">No suggestions found</div>
          <div className="text-xs text-gray-400">Run an AI analysis from the Actions page</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((s) => (
            <div key={s.id} className="card !mb-0 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge badge-${s.type.toLowerCase()}`}>{s.type}</span>
                  <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                  {s.confidenceScore != null && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      {Math.round(s.confidenceScore * 100)}% confidence
                      <span className="confidence-bar">
                        <span className="confidence-fill bg-emerald-500" style={{ width: `${s.confidenceScore * 100}%` }} />
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleDateString()} · {s.aiProvider}/{s.aiModel}
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-2 mb-3">
                {s.currentValue && (
                  <div className="bg-red-50 rounded-lg px-4 py-3 text-xs text-gray-600">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Current</div>
                    {s.currentValue}
                  </div>
                )}
                <div className="bg-emerald-50 rounded-lg px-4 py-3 text-xs text-[#1a1a2e]">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Suggested</div>
                  {s.suggestedValue}
                </div>
              </div>

              {s.reasoning && (
                <div className="text-xs text-gray-500 leading-relaxed mb-3">💡 {s.reasoning}</div>
              )}

              {/* Actions */}
              {s.status === "PENDING" && (
                <div className="flex gap-2">
                  <button className="btn-success btn-sm" disabled={acting === s.id} onClick={() => handleAction(s.id, "approve")}>✓ Approve</button>
                  <button className="btn-danger btn-sm"  disabled={acting === s.id} onClick={() => handleAction(s.id, "reject")}>✗ Reject</button>
                  <button className="btn-primary btn-sm" disabled={acting === s.id} onClick={() => handleAction(s.id, "apply")}>⚡ Apply to ASC</button>
                </div>
              )}
              {s.status === "APPROVED" && (
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" disabled={acting === s.id} onClick={() => handleAction(s.id, "apply")}>⚡ Apply to ASC</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
