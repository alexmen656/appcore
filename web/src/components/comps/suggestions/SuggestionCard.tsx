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

const typeBadge: Record<string, string> = {
  title: "bg-violet-50 text-violet-700",
  subtitle: "bg-blue-50 text-blue-700",
  keywords: "bg-amber-50 text-amber-700",
  description: "bg-green-50 text-green-700",
};

const statusBadge: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-emerald-50 text-emerald-700",
  applied: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
};

const badgeBase =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium";

const btnBase =
  "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

export default function SuggestionCard({
  suggestion: s,
  acting,
  onAction,
}: Props) {
  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`${badgeBase} ${typeBadge[s.type.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}
          >
            {s.type}
          </span>
          <span
            className={`${badgeBase} ${statusBadge[s.status.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}
          >
            {s.status}
          </span>
          {s.confidenceScore != null && (
            <span className="flex items-center gap-1 text-xs text-[#9ca3af]">
              {Math.round(s.confidenceScore * 100)}% confidence
              <span className="inline-block w-10 h-1 rounded-full bg-gray-200 overflow-hidden align-middle">
                <span
                  className="block h-full rounded-full bg-emerald-500"
                  style={{ width: `${s.confidenceScore * 100}%` }}
                />
              </span>
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#9ca3af] shrink-0 whitespace-nowrap">
          {new Date(s.createdAt).toLocaleDateString()} · {s.aiProvider}/
          {s.aiModel}
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {s.currentValue && (
          <div className="bg-red-50/60 rounded-xl px-4 py-3 text-xs text-[#4b5563]">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] mb-1">
              Current
            </div>
            {s.currentValue}
          </div>
        )}
        <div className="bg-emerald-50/60 rounded-xl px-4 py-3 text-xs text-[#111827]">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] mb-1">
            Suggested
          </div>
          {s.suggestedValue}
        </div>
      </div>
      {s.reasoning && (
        <div className="text-xs text-[#6b7280] leading-relaxed mb-3">
          {s.reasoning}
        </div>
      )}
      {s.status === "PENDING" && (
        <div className="flex gap-2">
          <button
            className={`${btnBase} bg-emerald-500 text-white hover:bg-emerald-600`}
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "approve")}
          >
            Approve
          </button>
          <button
            className={`${btnBase} bg-red-500 text-white hover:bg-red-600`}
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "reject")}
          >
            Reject
          </button>
          <button
            className={`${btnBase} bg-blue-500 text-white hover:bg-blue-600`}
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "apply")}
          >
            Apply to ASC
          </button>
        </div>
      )}
      {s.status === "APPROVED" && (
        <div className="flex gap-2">
          <button
            className={`${btnBase} bg-blue-500 text-white hover:bg-blue-600`}
            disabled={acting === s.id}
            onClick={() => onAction(s.id, "apply")}
          >
            Apply to ASC
          </button>
        </div>
      )}
    </div>
  );
}
