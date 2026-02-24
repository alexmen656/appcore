import type { Stats } from "../../../types";
export type { Stats };

interface Props {
  stats: Stats;
}

export default function StatsGrid({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {[
        { label: "Competitors", value: stats.apps, color: "" },
        { label: "Snapshots", value: stats.snapshots, color: "" },
        { label: "Keywords", value: stats.keywords, color: "" },
        {
          label: "Pending Suggestions",
          value: stats.pendingSuggestions,
          color: stats.pendingSuggestions > 0 ? "text-amber-500" : "",
        },
        {
          label: "Applied Suggestions",
          value: stats.appliedSuggestions,
          color: "text-emerald-500",
        },
        { label: "Rankings", value: stats.rankings, color: "" },
      ].map(({ label, value, color }) => (
        <div
          key={label}
          className="bg-white border border-[#eef0f3] rounded-2xl px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] mb-2">
            {label}
          </div>
          <div
            className={`text-[26px] font-semibold tracking-tight ${color || "text-[#111827]"}`}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
