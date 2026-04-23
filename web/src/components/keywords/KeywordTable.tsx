import { TH, TD, btnSecSm } from "../../styles";
import type { Keyword } from "../../types";
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from "lucide-react";

export type { Keyword };
export type SortKey =
  | "term"
  | "country"
  | "popularity"
  | "difficulty"
  | "rank"
  | "tracked";

const rankColor = (rank: number | null) => {
  if (rank == null) return "text-gray-400 dark:text-[#5c6478]";
  if (rank <= 5) return "text-emerald-600 font-semibold";
  if (rank <= 20) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
};

const trendDisplay = (trend: number | null) => {
  if (trend == null)
    return <span className="text-gray-400 dark:text-[#5c6478]">—</span>;
  if (trend === 0)
    return (
      <span className="text-gray-400 dark:text-[#5c6478] text-xs">±0</span>
    );
  if (trend > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium text-xs">
        <TrendingUp className="w-3 h-3" />
        +{trend}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-red-500 font-medium text-xs">
      <TrendingDown className="w-3 h-3" />
      {trend}
    </span>
  );
};

const diffColor = (d: number | null) =>
  d == null
    ? "text-gray-400 dark:text-[#5c6478]"
    : d > 60
      ? "text-red-500 font-medium"
      : d > 30
        ? "text-amber-500 font-medium"
        : "text-emerald-600 font-medium";

interface Props {
  keywords: Keyword[];
  selectedKeyword: Keyword | null;
  sortBy: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onRowClick: (k: Keyword) => void;
  onDelete: (id: string, term: string) => void;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span
      className={`inline-flex flex-col ml-1 leading-none ${active ? "opacity-100" : "opacity-25"}`}
    >
      <ChevronUp
        className={`w-3 h-3 -mb-1 ${active && dir === "asc" ? "text-[#D94412]" : "text-current"}`}
      />
      <ChevronDown
        className={`w-3 h-3 -mt-1 ${active && dir === "desc" ? "text-[#D94412]" : "text-current"}`}
      />
    </span>
  );
}

export default function KeywordTable({
  keywords,
  selectedKeyword,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  onDelete,
}: Props) {
  const col = (key: SortKey, label: string) => (
    <th
      className={`${TH} cursor-pointer select-none hover:text-[#111827] dark:hover:text-[#e8eaf0] transition-colors`}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon active={sortBy === key} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl overflow-hidden mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {col("term", "Keyword")}
            {col("country", "Store")}
            {col("popularity", "Popularity")}
            {col("difficulty", "Difficulty")}
            <th className={TH}>Results</th>
            {col("rank", "Our Rank")}
            <th className={TH}>Trend</th>
            <th className={TH}>Top Competitor</th>
            {/* {col("tracked", "Tracked")} */}
            <th className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((k) => (
            <tr
              key={k.id}
              onClick={() => onRowClick(k)}
              className={`cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/[0.03] ${selectedKeyword?.id === k.id ? "!bg-blue-50/60 dark:!bg-blue-900/20" : ""}`}
            >
              <td
                className={`${TD} font-medium text-[#111827] dark:text-[#e8eaf0]`}
              >
                {k.term}
              </td>
              <td className={`${TD} text-[#6b7280] dark:text-[#8b93a5]`}>
                <span className="inline-flex items-center gap-1.5">
                  <img
                    src={`/app/country-flags/${k.country.toLowerCase()}.svg`}
                    alt={k.country}
                    className="w-4 h-3 rounded-xs object-cover shrink-0"
                  />
                  {k.country.toUpperCase()}
                </span>
              </td>
              <td className={TD}>
                {k.popularity != null ? (
                  <span className="flex items-center gap-1.5 text-[#111827] dark:text-[#e8eaf0]">
                    {k.popularity.toFixed(0)}
                    <span className="inline-block h-1 w-8 bg-[#e5e7eb] dark:bg-[#2a2f3d] rounded-sm overflow-hidden align-middle ml-1.5">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${Math.min(k.popularity, 100)}%`,
                          background:
                            k.popularity > 60
                              ? "#10b981"
                              : k.popularity > 30
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                )}
              </td>
              <td className={TD}>
                <span className={diffColor(k.difficulty)}>
                  {k.difficulty != null ? (
                    k.difficulty.toFixed(0)
                  ) : (
                    <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                  )}
                </span>
              </td>
              <td className={`${TD} text-[#6b7280] dark:text-[#8b93a5]`}>
                {k.searchVolume != null ? (
                  k.searchVolume
                ) : (
                  <span className="text-[#9ca3af] dark:text-[#5c6478]">--</span>
                )}
              </td>
              <td className={TD}>
                {k.ourRank != null ? (
                  <span className={rankColor(k.ourRank)}>#{k.ourRank}</span>
                ) : (
                  <span className="text-[#9ca3af] dark:text-[#5c6478] text-xs">
                    not ranked
                  </span>
                )}
              </td>
              <td className={TD}>{trendDisplay(k.rankTrend)}</td>
              <td className={TD}>
                {k.topCompetitor ? (
                  <span className="text-xs text-gray-500 dark:text-[#8b93a5]">
                    #{k.topCompetitor.rank}{" "}
                    <span className="text-gray-400 dark:text-[#5c6478]">
                      {k.topCompetitor.name.length > 18
                        ? k.topCompetitor.name.substring(0, 18) + "…"
                        : k.topCompetitor.name}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                )}
              </td>
              {/* <td
                className={`${TD} text-[#9ca3af] dark:text-[#5c6478] text-xs`}
              >
                {k.trackingCount}×
              </td> */}
              <td className={TD}>
                <button
                  className={`${btnSecSm} !text-red-500 !border-red-100 dark:!border-red-900/40 hover:!bg-red-50 dark:hover:!bg-red-900/20`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(k.id, k.term);
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
