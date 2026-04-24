import {
  TD,
  badge,
  borderDefault,
  textMuted,
  textPrimary,
  textSecondary,
} from "../../styles";
import type { RecentSuggestion, LastJob } from "../../types";
export type { RecentSuggestion };

interface Props {
  suggestions: RecentSuggestion[];
  lastJob?: LastJob;
}

const TH = `text-left text-[12px] font-medium ${textSecondary} px-4 py-3 border-b border-[#f3f4f6] dark:border-[#2a2f3d] whitespace-nowrap`;

export default function RecentSuggestionsTable({
  suggestions,
  lastJob,
}: Props) {
  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl overflow-hidden`}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <div className={`text-[15px] font-semibold ${textPrimary}`}>
          Recent suggestions
        </div>
        {lastJob && (
          <span className={badge(lastJob.status)}>
            Last scan: {lastJob.status.toLowerCase()}
          </span>
        )}
      </div>
      {suggestions.length === 0 ? (
        <div className={`py-10 text-center ${textMuted} text-sm`}>
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
              <tr
                key={s.id}
                className="hover:bg-[#fafbfc] dark:hover:bg-white/[0.02]"
              >
                <td className={TD}>
                  <span className={badge(s.type.toLowerCase())}>{s.type}</span>
                </td>
                <td className={`${TD} ${textSecondary}`}>{s.locale}</td>
                <td className={TD}>
                  {s.confidence != null ? (
                    <span className={`flex items-center gap-3 ${textPrimary}`}>
                      <span className="w-[52px] text-right tabular-nums">
                        {Math.round(s.confidence * 100)}%
                      </span>
                      <span className="flex-1 max-w-[80px] h-1 bg-[#f3f4f6] dark:bg-[#2a2f3d] rounded-full overflow-hidden">
                        <span
                          className="block h-full bg-emerald-500 rounded-full"
                          style={{ width: `${s.confidence * 100}%` }}
                        />
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={TD}>
                  <span className={badge(s.status.toLowerCase())}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
