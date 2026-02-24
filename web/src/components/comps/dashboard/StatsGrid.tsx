export interface Stats {
  apps: number;
  snapshots: number;
  keywords: number;
  rankings: number;
  pendingSuggestions: number;
  appliedSuggestions: number;
  jobs: number;
}

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
          className="bg-white border border-[#e5e7eb] rounded-lg px-5 py-[18px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {label}
          </div>
          <div
            className={`text-[28px] font-bold tracking-tight ${color || "text-[#1a1a2e]"}`}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
