import { cardCls, TH, TD, badge } from "../../../styles";
import type { RecentSuggestion } from "../../../types";
export type { RecentSuggestion };

interface Props {
  suggestions: RecentSuggestion[];
}

export default function RecentSuggestionsTable({ suggestions }: Props) {
  return (
    <div className={cardCls}>
      <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] mb-4">
        Recent Suggestions
      </div>
      {suggestions.length === 0 ? (
        <div className="py-8 text-center text-[#9ca3af] text-sm">
          No suggestions yet — run an AI analysis first
        </div>
      ) : (
        <table className="w-full border-collapse">
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
              <tr key={s.id} className="hover:bg-gray-50/60">
                <td className={TD}>
                  <span className={badge(s.type.toLowerCase())}>{s.type}</span>
                </td>
                <td className={`${TD} text-[#6b7280]`}>{s.locale}</td>
                <td className={TD}>
                  {s.confidence != null ? (
                    <span className="flex items-center gap-1.5">
                      {Math.round(s.confidence * 100)}%
                      <span className="inline-block h-1 w-[60px] bg-[#e5e7eb] rounded-sm overflow-hidden align-middle ml-1.5">
                        <span
                          className="block h-full bg-emerald-500 rounded-sm"
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
