const card = "bg-white border border-[#eef0f3] rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]";
const TH =
  "text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] px-3.5 py-2.5 border-b border-[#f3f4f6] whitespace-nowrap";
const TD = "px-3.5 py-3 border-b border-[#f3f4f6] text-[13px] align-middle";

const badgeVariants: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  applied: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-600",
  title: "bg-violet-50 text-violet-700",
  subtitle: "bg-sky-50 text-sky-700",
  keywords: "bg-pink-50 text-pink-700",
  description: "bg-emerald-50 text-emerald-700",
};
const badge = (v: string) =>
  `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeVariants[v.toLowerCase()] ?? "bg-gray-50 text-gray-600"}`;

export interface RecentSuggestion {
  id: string;
  type: string;
  locale: string;
  value: string;
  confidence: number;
  status: string;
  createdAt: string;
}

interface Props {
  suggestions: RecentSuggestion[];
}

export default function RecentSuggestionsTable({ suggestions }: Props) {
  return (
    <div className={card}>
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
