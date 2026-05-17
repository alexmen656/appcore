import type { Stats } from "../../types";
import { borderDefault, textPrimary, textSecondary } from "../../styles";
export type { Stats };

interface Props {
  stats: Stats;
}

export default function StatsGrid({ stats }: Props) {
  const items = [
    { label: "Competitors", value: stats.apps, color: "" },
    { label: "Snapshots", value: stats.snapshots, color: "" },
    { label: "Keywords", value: stats.keywords, color: "" },
    {
      label: "Pending suggestions",
      value: stats.pendingSuggestions,
      color: stats.pendingSuggestions > 0 ? "text-amber-500" : "",
    },
    {
      label: "Applied suggestions",
      value: stats.appliedSuggestions,
      color: stats.appliedSuggestions > 0 ? "text-emerald-500" : "",
    },
    { label: "Rankings", value: stats.rankings, color: "" },
  ];

  return (
    <div className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl mb-5 overflow-hidden`}>
      <div className="grid grid-cols-3 lg:grid-cols-6 divide-x divide-[#f3f4f6] dark:divide-[#2a2f3d]">
        {items.map(({ label, value, color }) => (
          <div key={label} className="px-5 py-5">
            <div
              className={`text-[28px] font-semibold tracking-tight leading-none mb-1.5 ${color || textPrimary}`}
            >
              {value.toLocaleString()}
            </div>
            <div className={`text-[12px] ${textSecondary}`}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
