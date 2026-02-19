const card = "bg-white border border-[#e5e7eb] rounded-lg p-5";
const TH =
  "text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 px-3.5 py-2.5 border-b border-[#e5e7eb] whitespace-nowrap";
const TD = "px-3.5 py-3 border-b border-[#f0f0f0] text-[13px] align-middle";

const badgeVariants: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  applied: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-700",
  title: "bg-violet-100 text-violet-800",
  subtitle: "bg-sky-100 text-sky-800",
  keywords: "bg-pink-100 text-pink-800",
  description: "bg-emerald-50 text-emerald-700",
};
const badge = (v: string) =>
  `inline-block px-2 py-0.5 rounded text-[11px] font-semibold tracking-[0.3px] ${badgeVariants[v.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`;

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
      <div className="text-sm font-semibold text-[#1a1a2e] mb-4">
        Recent Suggestions
      </div>
      {suggestions.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
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
                <td className={`${TD} text-gray-500`}>{s.locale}</td>
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
