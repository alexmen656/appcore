import { badge } from "../../../styles";
import type { RecentSuggestion, LastJob } from "../../../types";
export type { RecentSuggestion };

interface Props {
  suggestions: RecentSuggestion[];
  lastJob?: LastJob;
}

const TH = "text-left text-[12px] font-medium text-[#6b7280] dark:text-[#8b93a5] px-4 py-3 border-b border-[#f3f4f6] dark:border-[#2a2f3d] whitespace-nowrap";
const TD = "px-4 py-3.5 border-b border-[#f3f4f6] dark:border-[#2a2f3d] text-[13px] align-middle";

export default function RecentSuggestionsTable({ suggestions, lastJob }: Props) {
  return (
    <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <div className="text-[15px] font-semibold text-[#111827] dark:text-[#e8eaf0]">Recent suggestions</div>
        {lastJob && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            lastJob.status === "COMPLETED"
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
              : lastJob.status === "FAILED"
              ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400"
              : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          }`}>
            Last scan: {lastJob.status.toLowerCase()}
          </span>
        )}
      </div>
      {suggestions.length === 0 ? (
        <div className="py-10 text-center text-[#9ca3af] dark:text-[#5c6478] text-sm">
          No suggestions yet — run an AI analysis first
        </div>
      ) : (
        <table className="w-full border-collapse mt-3">
          <thead>
            <tr>
              <th className={TH}>Type</th>
              <th className={TH}>Locale</th>
              <th className={TH}>Confidence</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id} className="hover:bg-[#fafbfc] dark:hover:bg-white/[0.02]">
                <td className={TD}>
                  <span className={badge(s.type.toLowerCase())}>{s.type}</span>
                </td>
                <td className={`${TD} text-[#6b7280] dark:text-[#8b93a5]`}>{s.locale}</td>
                <td className={TD}>
                  {s.confidence != null ? (
                    <span className="flex items-center gap-3 text-[#111827] dark:text-[#e8eaf0]">
                      <span className="w-[52px] text-right tabular-nums">{Math.round(s.confidence * 100)}%</span>
                      <span className="flex-1 max-w-[80px] h-1 bg-[#f3f4f6] dark:bg-[#2a2f3d] rounded-full overflow-hidden">
                        <span
                          className="block h-full bg-emerald-500 rounded-full"
                          style={{ width: `${s.confidence * 100}%` }}
                        />
                      </span>
                    </span>
                  ) : "—"}
                </td>
                <td className={TD}>
                  <span className={badge(s.status.toLowerCase())}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
