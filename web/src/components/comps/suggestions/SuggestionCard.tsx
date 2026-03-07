import type { Suggestion } from "../../../types";
export type { Suggestion };

interface Props {
  suggestion: Suggestion;
  acting: string | null;
  onAction: (id: string, action: "approve" | "reject" | "apply") => void;
}

const typeBadge: Record<string, string> = {
  title: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  subtitle: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  keywords: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  description: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
};

const statusBadge: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  applied: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
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
    <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`${badgeBase} ${typeBadge[s.type.toLowerCase()] ?? "bg-gray-100 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"}`}
          >
            {s.type}
          </span>
          <span
            className={`${badgeBase} ${statusBadge[s.status.toLowerCase()] ?? "bg-gray-100 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"}`}
          >
            {s.status}
          </span>
          {s.confidenceScore != null && (
            <span className="flex items-center gap-1 text-xs text-[#9ca3af] dark:text-[#5c6478]">
              {Math.round(s.confidenceScore * 100)}% confidence
              <span className="inline-block w-10 h-1 rounded-full bg-gray-200 dark:bg-[#2a2f3d] overflow-hidden align-middle">
                <span
                  className="block h-full rounded-full bg-emerald-500"
                  style={{ width: `${s.confidenceScore * 100}%` }}
                />
              </span>
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] shrink-0 whitespace-nowrap">
          {new Date(s.createdAt).toLocaleDateString()} · {s.aiProvider}/
          {s.aiModel}
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {s.currentValue && (
          <div className="bg-red-50/60 dark:bg-red-900/10 rounded-xl px-4 py-3 text-xs text-[#4b5563] dark:text-[#8b93a5]">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-1">
              Current
            </div>
            {s.currentValue}
          </div>
        )}
        <div className="bg-emerald-50/60 dark:bg-emerald-900/10 rounded-xl px-4 py-3 text-xs text-[#111827] dark:text-[#e8eaf0]">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-1">
            Suggested
          </div>
          {s.suggestedValue}
        </div>
      </div>
      {s.reasoning && (
        <div className="text-xs text-[#6b7280] dark:text-[#8b93a5] leading-relaxed mb-3">
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
