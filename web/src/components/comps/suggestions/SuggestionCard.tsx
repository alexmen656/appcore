export interface Suggestion {
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

interface Props {
  suggestion: Suggestion;
  acting: string | null;
  onAction: (id: string, action: "approve" | "reject" | "apply") => void;
}

export default function SuggestionCard({
  suggestion: s,
  acting,
  onAction,
}: Props) {
  return (
    <div className="card !mb-0 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge badge-${s.type.toLowerCase()}`}>
            {s.type}
          </span>
          <span className={`badge badge-${s.status.toLowerCase()}`}>
            {s.status}
          </span>
          {s.confidenceScore != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              {Math.round(s.confidenceScore * 100)}% confidence
              <span className="confidence-bar">
                <span
                  className="confidence-fill bg-emerald-500"
                  style={{ width: `${s.confidenceScore * 100}%` }}
                />
              </span>
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
          {new Date(s.createdAt).toLocaleDateString()} · {s.aiProvider}/
          {s.aiModel}
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {s.currentValue && (
          <div className="bg-red-50 rounded-lg px-4 py-3 text-xs text-gray-600">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Current
            </div>
            {s.currentValue}
          </div>
        )}
        <div className="bg-emerald-50 rounded-lg px-4 py-3 text-xs text-[#1a1a2e]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Suggested
          </div>
          {s.suggestedValue}
        </div>
      </div>
      {s.reasoning && (
        <div className="text-xs text-gray-500 leading-relaxed mb-3">
          💡 {s.reasoning}
        </div>
      )}
      {s.status === "PENDING" && (
        <div className="flex gap-2">
          <button
            className="btn-success btn-sm"
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "approve")}
          >
            ✓ Approve
          </button>
          <button
            className="btn-danger btn-sm"
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "reject")}
          >
            ✗ Reject
          </button>
          <button
            className="btn-primary btn-sm"
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "apply")}
          >
            ⚡ Apply to ASC
          </button>
        </div>
      )}
      {s.status === "APPROVED" && (
        <div className="flex gap-2">
          <button
            className="btn-primary btn-sm"
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "apply")}
          >
            ⚡ Apply to ASC
          </button>
        </div>
      )}
    </div>
  );
}
